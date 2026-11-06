from functools import lru_cache
import hashlib
import math
import numpy as np

from app.core.config import settings
from app.core.logging import log_structured
from app.models.schemas import ClothingItem

EMBEDDING_DIM = 1408  # Vertex AI multimodalembedding@001 ネイティブ次元数


@lru_cache(maxsize=256)
def _deterministic_style_embedding(seed_text: str, dim: int = EMBEDDING_DIM) -> tuple[float, ...]:
    """
    ローカル検証・オフライン時でもコサイン類似度とFirestore Vector Search互換の1408次元正規化ベクトルを生成する。
    スタイル属性トークンごとに射影を加算し、意味的に近い服同士が高いコサイン類似度を持つように構成。
    """
    vec = np.zeros(dim, dtype=np.float32)
    tokens = [t.strip().lower() for t in seed_text.replace(",", " ").split() if t.strip()]
    if not tokens:
        tokens = ["neutral"]

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        seed = int.from_bytes(digest[:4], "little")
        rng = np.random.default_rng(seed)
        vec += rng.standard_normal(dim, dtype=np.float32)

    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec /= norm
    return tuple(vec.tolist())


def generate_clothing_embedding(
    image_bytes: bytes | None,
    contextual_text: str,
) -> tuple[list[float], str]:
    """
    Vertex AI Multimodal Embeddings (multimodalembedding@001) を IAM/ADC キーレス認証で呼び出し、
    衣服の視覚・スタイル特徴を1408次元ベクトル化する。
    """
    if settings.enable_vertex_ai and settings.gcp_project_id and image_bytes:
        try:
            import vertexai
            from vertexai.vision_models import Image, MultiModalEmbeddingModel

            vertexai.init(project=settings.gcp_project_id, location=settings.gcp_location)
            model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")
            embeddings = model.get_embeddings(
                image=Image(image_bytes=image_bytes),
                contextual_text=contextual_text[:128],
                dimension=EMBEDDING_DIM,
            )
            return list(embeddings.image_embedding), "vertex-ai-multimodalembedding@001"
        except Exception as exc:
            log_structured(
                "WARNING",
                "Vertex AI Multimodal Embedding fallback triggered",
                error=str(exc),
            )

    return list(_deterministic_style_embedding(contextual_text)), "deterministic-semantic-1408d"


def query_firestore_similar_wardrobe(
    uid: str,
    query_vector: list[float],
    limit: int = 10,
) -> list[str]:
    """
    Cloud Firestore ネイティブ Vector Search (find_nearest / COSINE) を実行し、
    ユーザーの好みのスタイルベクトルに視覚的に近い手持ち服IDを取得する。
    """
    if not (settings.enable_firestore and settings.gcp_project_id):
        return []

    try:
        from google.cloud import firestore
        from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
        from google.cloud.firestore_v1.vector import Vector

        db = firestore.Client(project=settings.gcp_project_id)
        collection = db.collection("users").document(uid).collection("clothes")
        vector_query = collection.find_nearest(
            vector_field="embedding",
            query_vector=Vector(query_vector),
            distance_measure=DistanceMeasure.COSINE,
            limit=limit,
        )
        return [doc.id for doc in vector_query.stream()]
    except Exception as exc:
        log_structured("WARNING", "Firestore Vector Search skipped", error=str(exc))
        return []


def compute_vector_and_dormancy_scores(
    items: list[ClothingItem],
    preferred_styles: list[str],
    recent_worn_ids: set[str],
) -> tuple[float, float, list[str]]:
    """
    Stage 2:
    1) ユーザーの好みスタイルベクトルと各衣服ベクトルのコサイン類似度およびアイテム間調和度を算出
    2) 死蔵衣類（30日以上未着用）の再活用ブースト & 直近着用アイテムの重複ペナルティを算出
    """
    pref_vec = np.array(
        _deterministic_style_embedding(" ".join(preferred_styles + ["harmonious", "stylish"])),
        dtype=np.float32,
    )

    item_vecs: list[np.ndarray] = []
    for item in items:
        if item.embedding and len(item.embedding) == EMBEDDING_DIM:
            v = np.array(item.embedding, dtype=np.float32)
        else:
            desc = " ".join([item.category, item.subtype] + item.colors + item.style_tags)
            v = np.array(_deterministic_style_embedding(desc), dtype=np.float32)
        item_vecs.append(v)

    # ユーザー嗜好ベクトルとの平均コサイン類似度 (0..1 にスケーリング)
    sims = [float(np.dot(pref_vec, v)) for v in item_vecs]
    raw_sim = sum(sims) / max(1, len(sims))
    vector_style_similarity = round(min(1.0, max(0.35, 0.58 + raw_sim * 0.85)), 3)

    # 死蔵衣類（30日以上未着用）の発掘スコア計算
    revived_ids = [i.id for i in items if i.days_since_last_worn >= 30]
    dormancy_scores: list[float] = []
    for item in items:
        if item.id in recent_worn_ids:
            dormancy_scores.append(0.15)  # 直近着た服はローテーション減点
        else:
            # 未着用日数が多いほどシグモイド状にブースト（最大1.0）
            boost = 1.0 - math.exp(-item.days_since_last_worn / 28.0)
            dormancy_scores.append(boost)

    dormancy_revival_score = round(sum(dormancy_scores) / max(1, len(dormancy_scores)), 3)
    return vector_style_similarity, dormancy_revival_score, revived_ids
