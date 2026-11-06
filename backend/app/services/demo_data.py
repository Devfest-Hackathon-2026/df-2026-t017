from app.models.schemas import ClothingItem, RawCalendarEvent, UserProfile, WeatherSnapshot


def get_demo_wardrobe() -> list[ClothingItem]:
    """
    審査員が1クリックで『Clo値フィルタ』『雨天の靴制御』『死蔵衣類（30日以上未着用）の再発見』を
    すべて体験できるよう設計されたリアルな手持ちクローゼットデータ（全12着）。
    """
    return [
        # Tops
        ClothingItem(
            id="top_01",
            name="オックスフォード・ボタンダウンシャツ",
            category="top",
            subtype="shirt",
            colors=["サックスブルー"],
            formality=4,
            clo_value=0.25,
            wear_count=12,
            days_since_last_worn=4,
            style_tags=["clean", "office", "smart-casual"],
        ),
        ClothingItem(
            id="top_02",
            name="ファインメリノ・モックネックニット",
            category="top",
            subtype="knit",
            colors=["アイボリー"],
            formality=4,
            clo_value=0.36,
            wear_count=2,
            days_since_last_worn=42,  # 死蔵衣類！
            style_tags=["clean", "minimal", "warm"],
        ),
        ClothingItem(
            id="top_03",
            name="ヘビーウェイト・リラックススウェット",
            category="top",
            subtype="sweatshirt",
            colors=["アッシュグレー"],
            formality=2,
            clo_value=0.34,
            wear_count=9,
            days_since_last_worn=2,
            style_tags=["casual", "relaxed"],
        ),
        ClothingItem(
            id="top_04",
            name="オーガニックコットン・クルーTシャツ",
            category="top",
            subtype="t-shirt",
            colors=["ホワイト"],
            formality=2,
            clo_value=0.09,
            wear_count=18,
            days_since_last_worn=20,
            style_tags=["casual", "minimal", "summer"],
        ),
        # Bottoms
        ClothingItem(
            id="btm_01",
            name="ウールライク・テーパードスラックス",
            category="bottom",
            subtype="slacks",
            colors=["チャコール"],
            formality=4,
            clo_value=0.24,
            wear_count=14,
            days_since_last_worn=3,
            style_tags=["clean", "office", "minimal"],
        ),
        ClothingItem(
            id="btm_02",
            name="セルビッジ・ストレートデニム",
            category="bottom",
            subtype="denim",
            colors=["インディゴネイビー"],
            formality=2,
            clo_value=0.26,
            wear_count=11,
            days_since_last_worn=6,
            style_tags=["casual", "clean"],
        ),
        ClothingItem(
            id="btm_03",
            name="ツータック・チノトラウザー",
            category="bottom",
            subtype="chino",
            colors=["オリーブベージュ"],
            formality=3,
            clo_value=0.23,
            wear_count=1,
            days_since_last_worn=38,  # 死蔵衣類！
            style_tags=["smart-casual", "minimal"],
        ),
        # Outers
        ClothingItem(
            id="out_01",
            name="撥水ステンカラー・ウールライナーコート",
            category="outer",
            subtype="coat",
            colors=["ネイビー"],
            formality=4,
            clo_value=0.56,
            water_resistant=True,
            wear_count=3,
            days_since_last_worn=35,  # 死蔵衣類！
            style_tags=["clean", "office", "rain-ready"],
        ),
        ClothingItem(
            id="out_02",
            name="フランネル・テーラードジャケット",
            category="outer",
            subtype="jacket",
            colors=["ダークブラウン"],
            formality=4,
            clo_value=0.45,
            water_resistant=False,
            wear_count=6,
            days_since_last_worn=11,
            style_tags=["clean", "smart-casual"],
        ),
        ClothingItem(
            id="out_03",
            name="ミラノリブ・Vネックカーディガン",
            category="outer",
            subtype="cardigan",
            colors=["ブラック"],
            formality=3,
            clo_value=0.28,
            water_resistant=False,
            wear_count=1,
            days_since_last_worn=48,  # 死蔵衣類！
            style_tags=["minimal", "clean", "layered"],
        ),
        # Shoes
        ClothingItem(
            id="sho_01",
            name="GORE-TEX レザーコインローファー",
            category="shoes",
            subtype="loafer",
            colors=["ブラック"],
            formality=4,
            clo_value=0.05,
            water_resistant=True,
            wear_count=8,
            days_since_last_worn=5,
            style_tags=["clean", "office", "rain-ready"],
        ),
        ClothingItem(
            id="sho_02",
            name="キャンバス・ローカットスニーカー",
            category="shoes",
            subtype="sneaker",
            colors=["オフホワイト"],
            formality=2,
            clo_value=0.04,
            water_resistant=False,  # 雨の日はStage1で自動除外される！
            wear_count=15,
            days_since_last_worn=1,
            style_tags=["casual", "minimal"],
        ),
    ]


def get_demo_presets() -> list[dict]:
    """審査員がワンクリックで天候・予定を切り替えて推論の変化を検証できるシナリオプリセット。"""
    return [
        {
            "id": "autumn_busy_rain",
            "label": "シナリオA: ゼミ→ITインターン→夜会食（夕方から雨・夜冷え11℃）",
            "weather": WeatherSnapshot(
                location_name="東京・渋谷",
                morning_temp_c=14.0,
                afternoon_temp_c=17.5,
                evening_temp_c=11.0,
                wind_speed_ms=3.5,
                rain_probability=0.65,
                condition_label="曇り一時雨（夜冷え込み）",
            ),
            "events": [
                RawCalendarEvent(start_time="10:30", end_time="12:00", title="情報工学ゼミ発表", location="本郷キャンパス"),
                RawCalendarEvent(start_time="14:00", end_time="18:00", title="ITインターン 開発MTG・出社", location="渋谷オフィス"),
                RawCalendarEvent(start_time="19:00", end_time="21:00", title="チームメンバーとビストロ食事会", location="恵比寿"),
            ],
            "profile": UserProfile(cold_sensitivity=0, preferred_styles=["clean", "minimal"]),
        },
        {
            "id": "sunny_mild_walk",
            "label": "シナリオB: 晴天の休日・公園散歩とカフェ（昼22℃・活動量高め）",
            "weather": WeatherSnapshot(
                location_name="東京・代々木",
                morning_temp_c=16.5,
                afternoon_temp_c=22.0,
                evening_temp_c=17.0,
                wind_speed_ms=1.5,
                rain_probability=0.05,
                condition_label="快晴・穏やかな陽気",
            ),
            "events": [
                RawCalendarEvent(start_time="11:00", end_time="14:00", title="代々木公園を散歩・買い物", location="原宿・代々木"),
                RawCalendarEvent(start_time="15:00", end_time="17:00", title="友人とカフェで読書", location="奥渋"),
            ],
            "profile": UserProfile(cold_sensitivity=0, preferred_styles=["casual", "minimal"]),
        },
        {
            "id": "cold_morning_office",
            "label": "シナリオC: 木枯らしの終日オフィス出社（最高12℃・風強め）",
            "weather": WeatherSnapshot(
                location_name="東京・丸の内",
                morning_temp_c=8.5,
                afternoon_temp_c=12.0,
                evening_temp_c=7.5,
                wind_speed_ms=5.0,
                rain_probability=0.20,
                condition_label="晴れ・北風強い",
            ),
            "events": [
                RawCalendarEvent(start_time="09:30", end_time="18:30", title="クライアント面談・終日出社", location="丸の内オフィス"),
            ],
            "profile": UserProfile(cold_sensitivity=1, preferred_styles=["clean", "office"]),
        },
    ]
