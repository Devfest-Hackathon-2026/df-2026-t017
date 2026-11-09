import json
import re
from app.core.config import settings
from app.core.logging import log_structured
from app.models.schemas import (
    AnalyzeClothingResponse,
    ChatContextSummary,
    ChatIntentRequest,
    ChatIntentResponse,
    ClothingCategory,
    RawCalendarEvent,
)

# 衣服サブタイプごとの標準Clo値およびカテゴリ・フォーマル度辞書（決定論的・被服気候学標準値）
CLOTHING_KNOWLEDGE_BASE = [
    # Tops
    {"patterns": ["タートルネック", "モックネック", "ハイネック"], "category": "top", "subtype": "knit", "clo": 0.36, "formality": 4, "tags": ["clean", "minimal", "warm"]},
    {"patterns": ["ニット", "セーター", "knit", "sweater"], "category": "top", "subtype": "knit", "clo": 0.34, "formality": 3, "tags": ["clean", "casual", "warm"]},
    {"patterns": ["シャツ", "ボタンダウン", "shirt", "ワイシャツ", "ドレスシャツ", "ブラウス"], "category": "top", "subtype": "shirt", "clo": 0.25, "formality": 4, "tags": ["clean", "office", "smart-casual"]},
    {"patterns": ["スウェット", "トレーナー", "パーカー", "フーディ", "sweat", "hoodie"], "category": "top", "subtype": "sweatshirt", "clo": 0.34, "formality": 2, "tags": ["casual", "relaxed"]},
    {"patterns": ["ロンt", "長袖tシャツ", "長袖カットソー"], "category": "top", "subtype": "long-sleeve", "clo": 0.20, "formality": 2, "tags": ["casual", "minimal"]},
    {"patterns": ["tシャツ", "ティーシャツ", "カットソー", "半袖"], "category": "top", "subtype": "t-shirt", "clo": 0.09, "formality": 2, "tags": ["casual", "minimal", "summer"]},
    # Outers
    {"patterns": ["ダウン", "ダウンジャケット", "ダウンコート", "パファー", "down"], "category": "outer", "subtype": "down", "clo": 0.75, "formality": 3, "tags": ["warm", "winter", "casual"]},
    {"patterns": ["チェスターコート", "ウールコート", "ステンカラーコート", "トレンチコート", "コート", "coat"], "category": "outer", "subtype": "coat", "clo": 0.55, "formality": 4, "tags": ["clean", "office", "smart-casual"]},
    {"patterns": ["テーラードジャケット", "ジャケット", "ブレザー", "jacket", "blazer"], "category": "outer", "subtype": "jacket", "clo": 0.45, "formality": 4, "tags": ["clean", "office", "smart-casual"]},
    {"patterns": ["カーディガン", "cardigan"], "category": "outer", "subtype": "cardigan", "clo": 0.28, "formality": 3, "tags": ["clean", "minimal", "layered"]},
    {"patterns": ["ブルゾン", "マウンテンパーカー", "シェルジャケット", "ウインドブレーカー"], "category": "outer", "subtype": "blouson", "clo": 0.38, "formality": 2, "tags": ["casual", "outdoor", "rain-ready"]},
    # Bottoms
    {"patterns": ["スラックス", "トラウザー", "テーパードパンツ", "slacks"], "category": "bottom", "subtype": "slacks", "clo": 0.24, "formality": 4, "tags": ["clean", "office", "minimal"]},
    {"patterns": ["デニム", "ジーンズ", "ジーパン", "denim", "jeans"], "category": "bottom", "subtype": "denim", "clo": 0.26, "formality": 2, "tags": ["casual", "clean"]},
    {"patterns": ["チノパン", "チノ", "chino"], "category": "bottom", "subtype": "chino", "clo": 0.23, "formality": 3, "tags": ["smart-casual", "clean"]},
    {"patterns": ["スウェットパンツ", "ジョガーパンツ"], "category": "bottom", "subtype": "sweatpants", "clo": 0.25, "formality": 1, "tags": ["casual", "relaxed"]},
    {"patterns": ["ショートパンツ", "短パン", "ショーツ"], "category": "bottom", "subtype": "shorts", "clo": 0.08, "formality": 1, "tags": ["summer", "casual"]},
    # Shoes
    {"patterns": ["ローファー", "革靴", "レザーシューズ", "loafer"], "category": "shoes", "subtype": "loafer", "clo": 0.05, "formality": 4, "tags": ["clean", "office"]},
    {"patterns": ["ブーツ", "サイドゴア", "boots"], "category": "shoes", "subtype": "boots", "clo": 0.06, "formality": 4, "tags": ["clean", "winter"]},
    {"patterns": ["スニーカー", "sneaker", "靴", "シューズ"], "category": "shoes", "subtype": "sneaker", "clo": 0.04, "formality": 2, "tags": ["casual", "minimal"]},
    {"patterns": ["バッグ", "かばん", "鞄", "bag"], "category": "bag", "subtype": "handbag", "clo": 0.0, "formality": 3, "tags": ["accessory"]},
    {"patterns": ["カチューシャ", "ヘアバンド", "小物", "accessory"], "category": "accessory", "subtype": "headband", "clo": 0.0, "formality": 3, "tags": ["accessory", "feminine"]},
]

COLOR_KEYWORDS = {
    "黒": "ブラック", "ブラック": "ブラック", "black": "ブラック",
    "白": "ホワイト", "ホワイト": "ホワイト", "white": "ホワイト",
    "グレー": "グレー", "チャコール": "チャコール", "gray": "グレー", "grey": "グレー",
    "ネイビー": "ネイビー", "紺": "ネイビー", "navy": "ネイビー", "青": "ブルー", "ブルー": "ブルー",
    "ベージュ": "ベージュ", "beige": "ベージュ", "アイボリー": "アイボリー",
    "ブラウン": "ブラウン", "茶": "ブラウン", "brown": "ブラウン", "キャメル": "キャメル",
    "カーキ": "オリーブカーキ", "オリーブ": "オリーブカーキ", "緑": "グリーン", "グリーン": "グリーン",
    "赤": "レッド", "レッド": "レッド", "ワイン": "ワインレッド", "ボルドー": "ボルドー",
    "サックス": "サックスブルー", "水色": "サックスブルー",
}


def parse_clothing_from_text(text: str) -> AnalyzeClothingResponse | None:
    """
    自然言語テキスト（例:「黒のタートルネックニット追加」「撥水のネイビーコート買った」）から
    決定論的に被服気候学属性（カテゴリ、Clo値、フォーマル度、色、撥水性）を抽出する（LLMコスト0円）。
    """
    cleaned = text.lower()
    
    # 登録・追加系の意図キーワードが含まれているかチェック
    is_add_intent = any(k in cleaned for k in ["追加", "登録", "買った", "持ってる", "ある", "保存", "クローゼットに", "手持ち"])
    
    matched_item = None
    for item in CLOTHING_KNOWLEDGE_BASE:
        if any(pat in cleaned for pat in item["patterns"]):
            matched_item = item
            break

    # アイテム名が特定できない場合は None
    if not matched_item:
        return None

    # 色の抽出
    colors: list[str] = []
    for word, label in COLOR_KEYWORDS.items():
        if word in cleaned:
            if label not in colors:
                colors.append(label)
    if not colors:
        colors = ["ブラック"]

    # 撥水判定
    is_water_resistant = any(k in cleaned for k in ["撥水", "防水", "gore-tex", "ゴアテックス", "ウォータープルーフ", "雨用"])
    if is_water_resistant:
        matched_item["tags"].append("rain-ready")

    # アイテム名の生成
    color_prefix = colors[0] if colors else ""
    suggested_name = f"{color_prefix}の{matched_item['patterns'][0].capitalize()}"
    # 文中から自然な名称候補を取り出せるか試す
    m = re.search(r'([一-龠ぁ-んァ-ヶa-zA-Z0-9・ー]+(シャツ|ニット|コート|スラックス|デニム|パンツ|スニーカー|ローファー|ジャケット|パーカー|カーディガン|ダウン))', text)
    if m:
        suggested_name = m.group(1)

    return AnalyzeClothingResponse(
        suggested_name=suggested_name,
        category=matched_item["category"],  # type: ignore[arg-type]
        subtype=matched_item["subtype"],
        colors=colors[:2],
        formality=matched_item["formality"],
        clo_value=matched_item["clo"],
        water_resistant=is_water_resistant,
        style_tags=list(set(matched_item["tags"])),
        embedding_dimensions=1408,
        analysis_source="rule-based-nlp",
    )


def resolve_chat_intent(payload: ChatIntentRequest) -> ChatIntentResponse:
    """
    省コスト2段階ハイブリッド対話ルーター:
      Tier 1: 決定論的パターンマッチング（0トークン・即答）
      Tier 2: Vertex AI Gemini Structured Outputs（複雑な相談時のみ最小トークンで呼出）
    """
    raw = payload.message.strip()
    lower = raw.lower()

    # --- Tier 1-A: テキストからの手持ち服登録 ---
    clothing_draft = parse_clothing_from_text(raw)
    if clothing_draft and any(k in lower for k in ["追加", "登録", "買った", "持ってる", "ある", "服", "クローゼット"]):
        return ChatIntentResponse(
            intent="add_clothing_text",
            assistant_message=f"「{clothing_draft.suggested_name}」（断熱性 {clothing_draft.clo_value} Clo / フォーマル度 Lv.{clothing_draft.formality}）を解析しました！登録内容を確認して、よろしければクローゼットに追加してください。",
            clothing_draft=clothing_draft,
            suggested_chips=["✨ クローゼットに登録", "📷 写真から登録", "今日のコーデに戻る"],
            intent_source="tier1-deterministic-rule",
        )

    # --- Tier 1-B: アイテム部分入れ替え (Swap) ---
    if any(k in lower for k in ["靴変え", "靴を", "スニーカーに", "ローファーに", "靴入れ替え", "シューズ変え", "足元変え"]):
        return ChatIntentResponse(
            intent="swap_item",
            assistant_message="今日の気温と天候（撥水性・Clo値）を満たすシューズの差し替え候補を調べました。以下から選んでコーディネートを更新できます。",
            target_category="shoes",
            suggested_chips=["スニーカーにする", "ローファーにする", "アウターを変える", "全体の提案を見る"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["アウター変え", "上着変え", "コート変え", "アウター入れ替え", "羽織り変え"]):
        return ChatIntentResponse(
            intent="swap_item",
            assistant_message="今日の時間帯別寒暖差に合わせて、熱的快適性を維持できるアウターの差し替え候補です。",
            target_category="outer",
            suggested_chips=["コートにする", "ジャケットにする", "カーディガンにする", "全体の提案を見る"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["トップス変え", "シャツ変え", "ニット変え", "上を変え"]):
        return ChatIntentResponse(
            intent="swap_item",
            assistant_message="トップスを差し替えた場合の熱的適正候補です。",
            target_category="top",
            suggested_chips=["シャツにする", "ニットにする", "スウェットにする", "全体の提案を見る"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["ボトムス変え", "パンツ変え", "ズボン変え", "下を変え"]):
        return ChatIntentResponse(
            intent="swap_item",
            assistant_message="ボトムスの差し替え候補です。全体のフォーマル度と断熱性のバランスを保ちます。",
            target_category="bottom",
            suggested_chips=["スラックスにする", "デニムにする", "チノにする", "全体の提案を見る"],
            intent_source="tier1-deterministic-rule",
        )

    # --- Tier 1-C: 天気・都市・現在地・居住区変更 ---
    # 0. 今日の天気・天気確認
    if any(k in lower for k in ["今日の天気", "天気は", "天気を教え", "天気教えて", "天気の情報", "天気予報", "現在の天気", "いまの天気"]):
        return ChatIntentResponse(
            intent="update_weather",
            location_query=None,
            assistant_message="本日の気象情報とお出かけアドバイスです。",
            suggested_chips=["今日のコーデを見る", "現在地にする", "居住区に戻す"],
            intent_source="tier1-deterministic-rule",
        )

    # 1. GPS現在地
    if any(k in lower for k in ["現在地", "いまいる場所", "今いる場所", "今いるところ", "いまいるとこ", "今ここ", "位置情報取得", "位置情報更新", "gps"]):
        return ChatIntentResponse(
            intent="get_current_location",
            assistant_message="現在地の位置情報（GPS）を取得して、ピンポイントの気象データと実効気温を反映します。",
            suggested_chips=["今日のコーデを見る", "傘の確認", "居住区に戻す"],
            intent_source="tier1-deterministic-rule",
        )

    # 2. 居住区に戻す
    if any(k in lower for k in ["居住区に戻", "自宅に戻", "自宅の天気", "家の天気", "家に帰", "居住区の天気"]):
        return ChatIntentResponse(
            intent="reset_to_home",
            assistant_message="デフォルト居住区の天気に戻してコーディネートを再計算します。",
            suggested_chips=["今日のコーデを見る", "現在地にする", "予定を確認"],
            intent_source="tier1-deterministic-rule",
        )

    # 3. 居住区に設定
    home_match = re.search(r'([一-龠ぁ-んァ-ヶa-zA-Z0-9・ー]+?)(?:を|に)?(?:居住区|自宅|マイエリア)(?:に設定|にして|として登録|登録)', raw)
    if home_match:
        target_loc = home_match.group(1).replace("を", "").replace("に", "").strip()
        if target_loc:
            return ChatIntentResponse(
                intent="set_home_location",
                location_query=target_loc,
                assistant_message=f"「{target_loc}」をデフォルト居住区に設定します。",
                suggested_chips=["この地域の天気を見る", "今日のコーデを見る"],
                intent_source="tier1-deterministic-rule",
            )
    if any(k in lower for k in ["ここを居住区", "ここを自宅", "現在地を居住区", "居住区に設定"]):
        return ChatIntentResponse(
            intent="set_home_location",
            location_query=None,  # 現在の場所を居住区に設定
            assistant_message="現在の場所をデフォルト居住区に設定します。",
            suggested_chips=["今日のコーデを見る", "予定を確認"],
            intent_source="tier1-deterministic-rule",
        )

    # 4. 天気・都市変更 (パターンマッチ & 主要都市)
    loc_match = re.search(r'(?:場所[をは]|天気[をは]|行き先[をは]|)([一-龠ぁ-んァ-ヶa-zA-Z0-9・ー]{2,10})(?:の天気|の気温|にして|に変えて|に変更|に行く|に行きます|で過ごす)', raw)
    if loc_match:
        found_loc = loc_match.group(1).strip()
        if found_loc not in [
            "今日", "明日", "昨日", "これ", "それ", "コーデ", "洋服", "服",
            "スニーカー", "ローファー", "ブーツ", "アウター", "コート", "ジャケット",
            "カーディガン", "ダウン", "シャツ", "ニット", "パーカー", "スラックス",
            "デニム", "チノ", "チノパン", "靴", "全体", "カジュアル", "きれいめ",
            "フォーマル", "オフィス", "休日", "標準", "寒がり", "暑がり",
        ]:
            return ChatIntentResponse(
                intent="update_weather",
                assistant_message=f"{found_loc}の最新気象データを取得し、気温・寒暖差に合わせた断熱性（Clo値）で提案を再計算します。",
                location_query=found_loc,
                suggested_chips=["今日のコーデを見る", "現在地にする", "居住区に戻す", "少し暖かくする"],
                intent_source="tier1-deterministic-rule",
            )

    cities = ["東京", "渋谷", "新宿", "銀座", "横浜", "大阪", "梅田", "難波", "京都", "烏丸", "名古屋", "福岡", "天神", "博多", "札幌", "仙台", "那覇", "金沢", "世田谷", "鎌倉", "神戸", "広島"]
    for city in cities:
        if city in raw and (raw.strip() == city or any(k in lower for k in ["天気", "気温", "にして", "に変えて", "で", "行", "いる", "場所"])):
            return ChatIntentResponse(
                intent="update_weather",
                assistant_message=f"{city}の最新気象データを取得し、気温・寒暖差に合わせた断熱性（Clo値）で提案を再計算します。",
                location_query=city,
                suggested_chips=["今日のコーデを見る", "現在地にする", "居住区に戻す", "少し暖かくする"],
                intent_source="tier1-deterministic-rule",
            )

    # --- Tier 1-D: 寒がり/暑がり体感調整 ---
    if any(k in lower for k in ["寒がり", "寒い", "冷える", "暖かく", "あったかく", "防寒"]):
        return ChatIntentResponse(
            intent="update_sensitivity",
            assistant_message="体感を「寒がり（+1）」に設定しました。目標断熱性（Clo値）を引き上げ、暖かいレイヤードを優先して再計算します。",
            cold_sensitivity=1,
            suggested_chips=["✨ 暖かいコーデを見る", "アウターを変える", "標準に戻す"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["暑がり", "暑い", "涼しく", "薄着"]):
        return ChatIntentResponse(
            intent="update_sensitivity",
            assistant_message="体感を「暑がり（-1）」に設定しました。熱がこもらない軽快な組み合わせを優先して再計算します。",
            cold_sensitivity=-1,
            suggested_chips=["✨ 軽快なコーデを見る", "標準に戻す"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["標準", "リセット", "寒がり戻す"]):
        return ChatIntentResponse(
            intent="update_sensitivity",
            assistant_message="体感を「標準（0）」に戻しました。",
            cold_sensitivity=0,
            suggested_chips=["✨ 今日のコーデを見る"],
            intent_source="tier1-deterministic-rule",
        )

    # --- Tier 1-E: 眠っている服ブースト・スタイル・日常シーン変更 ---
    loc_name = payload.context.location_name or "現在地"

    if any(k in lower for k in ["死蔵", "眠っている服", "タンス", "着てない服", "久しぶり", "活用"]):
        return ChatIntentResponse(
            intent="recommend",
            assistant_message=f"クローゼットで30日以上袖を通されていない「眠っている服」を優先的に発掘し、【{loc_name}】の今日の天候・予定に合わせた新しい着回しを提案します！",
            preferred_styles=["dormancy_revival"],
            suggested_chips=["靴だけ変える", "カジュアルにする", "少し暖かくする", "手持ちの服確認"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["デート", "ディナー", "会食", "合コン", "女子会"]):
        return ChatIntentResponse(
            intent="recommend",
            assistant_message=f"好印象で上品な清潔感のあるスタイリングを優先して、【{loc_name}】の気温に合わせたコーディネートを構成します。",
            preferred_styles=["clean", "smart-casual"],
            suggested_chips=["靴を変える", "アウターを変える", "少し暖かくする", "全体の提案に戻る"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["就活", "面接", "インターン", "商談", "プレゼン", "登壇"]):
        return ChatIntentResponse(
            intent="recommend",
            assistant_message=f"フォーマル度を高め、【{loc_name}】の天候に適した誠実でスマートなビジネススタイルで再計算します。",
            preferred_styles=["office", "clean"],
            suggested_chips=["靴を変える", "少し暖かくする", "全体の提案に戻る"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["バイト", "アルバイト", "通学", "大学", "授業"]):
        return ChatIntentResponse(
            intent="recommend",
            assistant_message=f"動きやすさと清潔感を両立した、【{loc_name}】での一日にぴったりの組み合わせです。",
            preferred_styles=["clean", "casual"],
            suggested_chips=["スニーカーにする", "カジュアルにする", "少し暖かくする"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["きれいめ", "フォーマル", "オフィス", "きっちり"]):
        return ChatIntentResponse(
            intent="recommend",
            assistant_message=f"きれいめ・スマートカジュアルなスタイルを優先して、【{loc_name}】の寒暖差に合うコーデを再構成します。",
            preferred_styles=["clean", "office"],
            suggested_chips=["カジュアルにする", "靴だけ変える", "少し暖かくする", "手持ちの服確認"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["カジュアル", "ラフ", "リラックス", "休日", "散歩", "デニム", "スウェット", "パーカー"]):
        return ChatIntentResponse(
            intent="recommend",
            assistant_message=f"リラックス感のあるカジュアルスタイルを優先して、【{loc_name}】の天候に合わせて再計算します。",
            preferred_styles=["casual", "relaxed"],
            suggested_chips=["きれいめにする", "眠っている服を優先", "靴だけ変える", "少し暖かくする"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["今日何着る", "何着よう", "コーデ教えて", "おすすめ", "提案して", "服決めて", "明日のコーデ", "明日何着る", "コーデ見せて", "コーデを見る", "新しい基準"]):
        msg = (
            f"あなたの新しい体感学習基準を反映し、【{loc_name}】の気象条件に最適なコーディネートを算出しました！"
            if any(k in lower for k in ["明日のコーデ", "明日何着る", "新しい基準"])
            else f"【{loc_name}】の今日の気象データ・寒暖差・カレンダー予定に合わせて、最適なコーディネートを算出しました！"
        )
        return ChatIntentResponse(
            intent="recommend",
            assistant_message=msg,
            suggested_chips=["カジュアルにする", "眠っている服を優先", "靴だけ変える", "少し暖かくする"],
            intent_source="tier1-deterministic-rule",
        )

    # --- Tier 1-F: クローゼット確認・検索 ---
    if any(k in lower for k in ["クローゼット", "服一覧", "手持ち服見せて", "どんな服持ってる"]):
        return ChatIntentResponse(
            intent="open_closet",
            assistant_message="手持ちの服一覧ドロワーを開きます。ここから未着用日数の確認や洗濯中の設定ができます。",
            suggested_chips=["📷 新しい服を登録", "知的な服を探す", "今日のコーデに戻る"],
            intent_source="tier1-deterministic-rule",
        )
    if any(k in lower for k in ["探して", "ある？", "検索", "カフェ", "雨の日用", "知的な"]):
        return ChatIntentResponse(
            intent="search_wardrobe",
            assistant_message=f"「{raw}」の気分に合う服を、Vertex AI 1408次元ベクトル類似度で検索しました。",
            search_query=raw,
            suggested_chips=["クローゼットを開く", "今日のコーデを見る"],
            intent_source="tier1-deterministic-rule",
        )

    # --- Tier 1-G: 予定確認・スケジュール ---
    if any(k in lower for k in ["予定", "スケジュール", "カレンダー", "今日の予定", "予定見せて", "予定教えて", "今日のスケジュール"]):
        return ChatIntentResponse(
            intent="show_schedule",
            assistant_message="本日の予定一覧です。ここから予定の確認・追加やGoogleカレンダーとの同期ができます。",
            suggested_chips=["今日のコーデを見る", "現在地にする", "服を確認する"],
            intent_source="tier1-deterministic-rule",
        )

    # --- Tier 2: 自由文の問い合わせ (Vertex AI Gemini Structured Outputs) ---
    if settings.enable_vertex_ai and settings.gcp_project_id:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(
                vertexai=True,
                project=settings.gcp_project_id,
                location=settings.gcp_location,
            )
            prompt = (
                "あなたはAIスタイリスト『Closet Me』の軽量会話ルーターです。"
                "ユーザーの発話から次のいずれかのintentを判定し、親しみやすいスタイリストとしての短い回答（60文字以内）を返してください。\n"
                f"ユーザー発話: {raw}\n"
                f"現在のコンテキスト: {payload.context.model_dump_json()}\n"
                "可能なintent: recommend, swap_item, search_wardrobe, update_weather, general_reply"
            )
            res = client.models.generate_content(
                model=settings.gemini_model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=150,
                ),
            )
            reply_text = res.text.strip() if res.text else "ご要望に合わせてコーディネートを調整しますね。"
            return ChatIntentResponse(
                intent="general_reply",
                assistant_message=reply_text,
                suggested_chips=["✨ おすすめコーデを見る", "🔥 眠っている服を優先", "📷 服を登録する"],
                intent_source=f"tier2-vertex-gemini-{settings.gemini_model_name}",
            )
        except Exception as exc:
            log_structured("WARNING", "Tier 2 Gemini chat fallback triggered", error=str(exc))

    # デフォルトフォールバック（汎用AI雑談ではなく、被服気候学コンシェルジュとしての決定論的ガイド応答）
    return ChatIntentResponse(
        intent="general_reply",
        assistant_message=f"「{raw}」について承知しました！Closet Me は手持ち服データと被服気候学（Clo値）から最適解を算出する専用エンジンのため、自由対話ではなく以下のボタンや条件からご指定ください。",
        suggested_chips=["✨ 今日のコーデを見る", "🔥 眠っている服を優先", "👟 靴を変える", "🧥 アウターを変える", "📷 服を追加する"],
        intent_source="tier1-fallback",
    )
