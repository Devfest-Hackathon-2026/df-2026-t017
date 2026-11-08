# Closet Me — AIパーソナルスタイリスト

> **「眠っている服」と「今日の暮らし」を結び付け、毎朝の装いを共創する。**  
> DevFest GDG Japan Hackathon 2026 開発リポジトリ（対象カテゴリー：**クリエイティブ**）

---

## 1. コンセプトと「Own the Why」

日本の家庭には「1年間一度も袖を通されない死蔵衣類」が1人あたり平均25〜30着存在します。原因は服の不足ではなく、**「手持ち服 × 時間帯ごとの寒暖差 × 切り替わる予定（TPO）」の組み合わせを毎朝人間が想起しきれないこと**にあります。

**Closet Me** は、AIにすべてを丸投げするラッパーアプリではありません。
- **物理的快適性は「数理モデル」で解く**：被服気候学の国際指標 **Clo値（衣服の断熱性）** と活動代謝量（METs）から熱的に安全な組み合わせ空間を決定論的にフィルタリング。
- **視覚的調和と死蔵衣類の再発見は「ベクトル検索」で解く**：**Vertex AI Multimodal Embeddings × Cloud Firestore Vector Search** で眠っている服の新しい着回しを発掘。
- **TPO文脈理解と説明は「Gemini」で解く**：**Vertex AI Gemini**（Structured Outputs）が多基準評価と納得感のある推薦理由を生成。
- **ガイド付きリッチカード型チャットUI**：2×2実写写真コラージュ、靴やアウターのインライン差し替え（Swap）、推論トレース開示を備えた会話型UI。
- **3段階省コストIntentルーティング**：Tier 0〜1（0トークン/ミリ秒即答）とTier 2（最小JSON構造化）により、大会付与の $20 クレジットを保護しながら高速応答を実現。

---

## 2. Google Cloud ネイティブ・アーキテクチャ

```text
[Smartphone / Browser]
   │
   ▼
[Firebase App Hosting] ─── Next.js 15 (App Router / TypeScript / Tailwind CSS)
   │  HTTPS + Firebase Auth ID Token
   ▼
[Google Cloud Run] ─────── FastAPI (Python 3.12 / asia-northeast1)
   │  本番URL: https://closet-me-engine-778086128902.asia-northeast1.run.app
   ├── Stage 1: Physics Engine (被服気候学 Clo値 × METs 制約充足ソルバー)
   ├── Stage 2: Vector Revival (Vertex AI Multimodal Embeddings × Firestore Vector Search)
   ├── Stage 3: Multi-Criteria Re-ranker (Vertex AI Gemini via IAM/ADC キーレス認証)
   ├── Security: Cloud Secret Manager / カレンダー予定のプライバシーサニタイズ
   └── Observability: Cloud Logging 構造化推論トレース出力
```

---

## 3. ディレクトリ構成

```text
.
├── frontend/             # Next.js 15 Webアプリ (Firebase App Hosting 対応)
│   ├── apphosting.yaml   # Firebase App Hosting 設定ファイル
│   └── src/              # UIコンポーネント・APIクライアント
├── backend/              # FastAPI 推薦・数理最適化エンジン (Cloud Run 対応)
│   ├── Dockerfile        # 非root実行・Cloud Run 最適化コンテナ定義
│   ├── requirements.txt  # Python 依存パッケージ
│   └── app/
│       ├── core/         # Clo値物理計算エンジン・認証・Cloud Logging構造化ロガー
│       ├── models/       # Pydantic 型定義スキーマ
│       ├── services/     # Vertex AI Gemini / Embeddings / Firestore / Weather
│       └── api/          # REST エンドポイント
└── DevFest/              # 企画書・要件定義・Whyログ（意思決定記録）
    ├── README.md         # ドキュメント一覧・インデックス
    ├── ClosetMe_企画・要件定義.md # プロダクト仕様・AI/GCPアーキテクチャ詳細
    └── Whyログ.md        # 意思決定ログ（#1〜#10 技術選定と代替案のWhy）
```

---

## 4. ドキュメント一覧

詳細な企画書・技術設計書・意思決定ログは `DevFest/` ディレクトリに格納されています。

- **[Closet Me 企画・要件定義書（v1.0 確定版）](file:///c:/Users/rin01/sample-dev/DevFes/DevFest/ClosetMe_企画・要件定義.md)**: 課題定義、被服気候学Clo値数理モデル、Vertex AI / Vector Search パイプライン、UI/UX仕様
- **[Whyログ（意思決定記録）](file:///c:/Users/rin01/sample-dev/DevFes/DevFest/Whyログ.md)**: 大会テーマ「Own the Why」に基づく10件の技術選定・アーキテクチャ意思決定の記録
- **[DevFest ドキュメントインデックス](file:///c:/Users/rin01/sample-dev/DevFes/DevFest/README.md)**: 大会関連資料・審査基準・提出物まとめ

---

## 5. ローカル起動手順

審査・開発を即座に確認できるよう、GCP認証情報がないローカル環境でも**1クリック・デモモード（数理エンジン実稼働＋AIフォールバック）**で全フローが動作します。GCP環境変数を設定すると自動的に本番 Vertex AI / Firestore モードに切り替わります。

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate / macOS・Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8080
```

### Frontend (Next.js)
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

ブラウザで `http://localhost:3000` を開くと体験できます。
