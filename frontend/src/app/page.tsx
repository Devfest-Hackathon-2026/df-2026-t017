"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Compass,
  Home,
  MapPin,
  Plus,
  RefreshCw,
  Shirt,
  Trash2,
  X,
} from "lucide-react";
import {
  analyzeClothingPhoto,
  enrichEventsWeather,
  fetchDemoContext,
  fetchSwapCandidates,
  interpretChatMessage,
  lookupWeather,
  recordOutfitWear,
  requestRecommendations,
  searchWardrobeCrossModal,
  submitComfortFeedback,
} from "@/lib/apiClient";
import { compressImage } from "@/lib/imageUtils";
import {
  clearSavedWardrobe,
  loadSavedWardrobe,
  saveWardrobe,
} from "@/lib/storage";
import {
  AnalyzeClothingResponse,
  ChatMessage,
  ClothingCategory,
  ClothingItem,
  CrossModalSearchResult,
  DemoPreset,
  OutfitProposal,
  PipelineTrace,
  RawCalendarEvent,
  UserProfile,
  WeatherSnapshot,
} from "@/types/closet";
import {
  createGoogleCalendarOutfitEvent,
  fetchGoogleCalendarEvents,
  generateGoogleCalendarTemplateUrl,
  getGoogleCalendarAccessToken,
  getSimulatedGoogleEvents,
  isGoogleAuthAvailable,
} from "@/lib/googleCalendar";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { LocationWeatherModal } from "@/components/drawers/LocationWeatherModal";
import { CalendarDrawer } from "@/components/drawers/CalendarDrawer";

const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  top: "トップス",
  bottom: "ボトムス",
  outer: "アウター",
  shoes: "シューズ",
};

export default function ClosetMeChatApp() {
  // 基本状態
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [presets, setPresets] = useState<DemoPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [events, setEvents] = useState<RawCalendarEvent[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    cold_sensitivity: 0,
    preferred_styles: ["clean", "minimal"],
    banned_item_ids: [],
  });
  const [recentWornIds, setRecentWornIds] = useState<string[]>([]);
  const [selectedOutfitRank, setSelectedOutfitRank] = useState<number | null>(null);
  const [feedbackSubmittedRank, setFeedbackSubmittedRank] = useState<number | null>(null);
  const [latestOutfits, setLatestOutfits] = useState<OutfitProposal[]>([]);
  const [latestTrace, setLatestTrace] = useState<PipelineTrace | null>(null);

  // Google Calendar 状態
  const [gcalStatus, setGcalStatus] = useState<"disconnected" | "connected_real" | "connected_demo">("disconnected");
  const [gcalAccessToken, setGcalAccessToken] = useState<string | null>(null);
  const [isGCalLoading, setIsGCalLoading] = useState<boolean>(false);
  const [isCalendarSaving, setIsCalendarSaving] = useState<boolean>(false);

  // デフォルト居住区 & 行く場所
  const [homeLocation, setHomeLocation] = useState<string | null>(null);
  const destinationLocation = useMemo(() => {
    const evWithLoc = events.find((e) => e.location && e.location.trim().length > 0);
    return evWithLoc?.location ? evWithLoc.location.trim() : null;
  }, [events]);

  // ドロワー・モーダル開閉状態
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCalendarDrawerOpen, setIsCalendarDrawerOpen] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<ClothingItem | null>(null);

  // チャットタイムライン状態
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const isInitializedRef = useRef(false);
  const [suggestedChips, setSuggestedChips] = useState<string[]>([
    "今日のコーデを見る",
    "現在地にする",
    "眠っている服を優先",
    "靴だけ変える",
    "服を登録する",
    "カレンダー連携",
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  };

  const getNowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // メインの被服気候学 3段階推薦パイプライン実行
  const executeRecommendation = useCallback(
    async (
      w: WeatherSnapshot,
      ev: RawCalendarEvent[],
      prof: UserProfile,
      items: ClothingItem[],
      recent: string[],
      customIntroText?: string
    ) => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const destLoc = ev.find((e) => e.location && e.location.trim().length > 0)?.location?.trim() || null;
        const res = await requestRecommendations({
          weather: w,
          events: ev,
          profile: prof,
          wardrobe: items,
          recent_worn_ids: recent,
          destination_location: destLoc,
        });
        setLatestOutfits(res.outfits);
        setLatestTrace(res.trace);
        setSelectedOutfitRank(null);

        const time = getNowTime();
        const firstOutfit = res.outfits[0];
        let umbrellaSentence = "";
        if (firstOutfit?.umbrella_type === "umbrella") {
          umbrellaSentence = `まとまった雨の予報なので、長傘と雨に強い靴がおすすめです。`;
        } else if (firstOutfit?.umbrella_type === "folding") {
          umbrellaSentence = `急な雨や夕方に備えて、折りたたみ傘があると安心です。`;
        }

        const rainText = w.rain_probability >= 0.3 ? `（降水確率 ${Math.round(w.rain_probability * 100)}%）` : "";
        const intro = customIntroText || (
          `おはようございます！今日の${w.location_name}は最高${w.afternoon_temp_c}℃${rainText}ですね。${ev.length > 0 ? `予定（${ev.map(e => e.title).slice(0, 2).join("・")}）と` : ""}寒暖差に合わせて、手持ちの服から3つのコーディネートを組みました。${umbrellaSentence ? `\n\n${umbrellaSentence}` : ""}`
        );

        const newMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          sender: "assistant",
          timestamp: time,
          text: intro,
          attachment: {
            type: "outfits",
            outfits: res.outfits,
            trace: res.trace,
            selectedOutfitRank: null,
          },
        };

        setMessages((prev) => [...prev, newMsg]);
        setSuggestedChips([
          "今日これを着る",
          "眠っている服を優先",
          "靴だけ変える",
          "アウターを変える",
          "少し暖かくする",
          "服を追加する",
        ]);
        scrollToBottom();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "コーディネート計算に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 初回起動時のデータ取得 & 自動ウェルカム提案
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    (async () => {
      try {
        setIsLoading(true);

        // 保存されたデフォルト居住区を復元
        let savedHome: string | null = null;
        if (typeof window !== "undefined") {
          savedHome = localStorage.getItem("closetme_home_location");
          if (savedHome) {
            setHomeLocation(savedHome);
          }
        }

        const ctx = await fetchDemoContext();
        setPresets(ctx.presets);

        // 保存されたクローゼットを優先復元（リロードしても自分の服が維持される）
        const savedWardrobe = await loadSavedWardrobe();
        const initialWardrobe = savedWardrobe && savedWardrobe.length > 0 ? savedWardrobe : ctx.wardrobe;
        setWardrobe(initialWardrobe);

        if (ctx.presets.length > 0) {
          const first = ctx.presets[0];
          setSelectedPresetId(first.id);

          // 居住区が保存されていればその天気を優先取得、なければプリセット
          let initWeather = first.weather;
          let initEvents = first.events;
          if (savedHome) {
            try {
              initWeather = await lookupWeather(savedHome);
              initEvents = await enrichEventsWeather({ events: first.events, base_weather: initWeather });
            } catch {
              initWeather = first.weather;
            }
          }

          setWeather(initWeather);
          setEvents(initEvents);
          setProfile(first.profile);

          // 1. 朝のブリーフィングカードを投稿
          const briefingMsg: ChatMessage = {
            id: `msg_briefing_${Date.now()}`,
            sender: "assistant",
            timestamp: getNowTime(),
            text: `Closet Me へようこそ！今日の予定と天候を読み込みました。`,
            attachment: {
              type: "briefing",
              weather: initWeather,
              events: initEvents,
            },
          };
          setMessages([briefingMsg]);

          // 2. 本日の3コーデ提案を自動生成
          await executeRecommendation(
            initWeather,
            initEvents,
            first.profile,
            initialWardrobe,
            [],
            `本日の予定（${initEvents.map((e) => e.title).join("・")}）に合わせた、快適性と眠っている服の活用を両立する3案です！`
          );
        }
      } catch (err) {
        setErrorMsg("バックエンド（Cloud Run / uvicorn）への接続に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [executeRecommendation]);

  // シナリオプリセット切替（1-Click 検証）
  const handleSelectPreset = async (presetId: string) => {
    const found = presets.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(found.id);
    setWeather(found.weather);
    setEvents(found.events);
    setProfile(found.profile);
    setGcalStatus("disconnected");

    const userSwitchMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      timestamp: getNowTime(),
      text: `検証シナリオを切り替え: ${found.label}`,
    };

    setMessages((prev) => [...prev, userSwitchMsg]);
    await executeRecommendation(
      found.weather,
      found.events,
      found.profile,
      wardrobe,
      recentWornIds,
      `シナリオを「${found.label}」に切り替えました。寒暖差や活動量（METs）に合わせてClo値とフォーマル度を即座に再計算しました。`
    );
  };

  // 都市選択（気象データ更新）
  const handleSelectCity = async (cityName: string) => {
    setIsLoadingWeather(true);
    try {
      const newW = await lookupWeather(cityName);
      setWeather(newW);
      let updatedEvents = events;
      try {
        updatedEvents = await enrichEventsWeather({ events, base_weather: newW });
        setEvents(updatedEvents);
      } catch {
        // fallback
      }
      if (updatedEvents) {
        await executeRecommendation(
          newW,
          updatedEvents,
          profile,
          wardrobe,
          recentWornIds,
          `${newW.location_name}の最新気象データに更新しました。`
        );
      }
    } catch {
      setErrorMsg("気象データの取得に失敗しました。");
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // GPS現在地座標から気象データ更新
  const handleSelectCoords = async (lat: number, lng: number) => {
    setIsLoadingWeather(true);
    try {
      const newW = await lookupWeather({ lat, lng });
      setWeather(newW);
      let updatedEvents = events;
      try {
        updatedEvents = await enrichEventsWeather({ events, base_weather: newW });
        setEvents(updatedEvents);
      } catch {
        // fallback
      }
      if (updatedEvents) {
        await executeRecommendation(
          newW,
          updatedEvents,
          profile,
          wardrobe,
          recentWornIds,
          `📍 現在地（${newW.location_name}）の気象データと実効気温を反映しました。`
        );
      }
    } catch {
      setErrorMsg("現在地の気象データ取得に失敗しました。");
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // デフォルト居住区の保存
  const handleSetHomeLocation = (locName: string) => {
    setHomeLocation(locName);
    if (typeof window !== "undefined") {
      localStorage.setItem("closetme_home_location", locName);
    }
    const setMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      sender: "assistant",
      timestamp: getNowTime(),
      text: `🏡 デフォルト居住区を「${locName}」に設定しました。次回からこの地域の天気を優先して読み込みます。`,
      suggestedChips: ["今日のコーデを見る", "現在地にする", "服を確認する"],
    };
    setMessages((prev) => [...prev, setMsg]);
  };

  // チャットからGPS現在地を取得して更新
  const handleTriggerGeolocationFromChat = () => {
    if (!navigator.geolocation) {
      const errReply: ChatMessage = {
        id: `ast_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: "お使いのブラウザは位置情報取得に対応していません。「横浜の天気にして」のようにメッセージで教えてください。",
      };
      setMessages((prev) => [...prev, errReply]);
      scrollToBottom();
      return;
    }

    const waitMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      sender: "assistant",
      timestamp: getNowTime(),
      text: "📍 現在地のGPS位置情報を取得しています...",
    };
    setMessages((prev) => [...prev, waitMsg]);
    scrollToBottom();

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await handleSelectCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        const errText =
          err.code === err.PERMISSION_DENIED
            ? "位置情報の利用が許可されていませんでした。「渋谷の天気にして」「世田谷に行く」のようにチャットで都市名を入力して教えてください！"
            : "位置情報の取得に失敗しました。都市名を入力して教えてください。";
        const reply: ChatMessage = {
          id: `ast_${Date.now()}`,
          sender: "assistant",
          timestamp: getNowTime(),
          text: errText,
          suggestedChips: ["東京・渋谷", "神奈川・横浜", "大阪・梅田", "居住区に戻す"],
        };
        setMessages((prev) => [...prev, reply]);
        scrollToBottom();
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // チャットタイムラインに「場所・気象設定カード」を展開
  const handleOpenLocationInChat = () => {
    if (!weather) return;
    setMessages((prev) => {
      // 直前のメッセージがすでに location_settings カードであれば二重追加しない
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.attachment?.type === "location_settings") {
        return prev;
      }
      const locMsg: ChatMessage = {
        id: `ast_loc_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: `現在の場所「${weather.location_name}」の天気です。変更する場合は下から選ぶか、チャットで教えてくださいね。`,
        attachment: {
          type: "location_settings",
          weather,
          homeLocation,
          destinationLocation,
          umbrellaType: latestOutfits[0]?.umbrella_type || "none",
          umbrellaAdvice: latestOutfits[0]?.umbrella_advice,
        },
        suggestedChips: ["📍 現在地にする", "🏡 居住区に戻す", "今日のコーデを見る"],
      };
      return [...prev, locMsg];
    });
    scrollToBottom();
  };

  // チャットタイムラインに「予定・スケジュールカード」を展開（時間帯別のピンポイント天気も同期）
  const handleOpenScheduleInChat = async () => {
    let currentEvents = events;
    if (weather && currentEvents.some((e) => !e.weather)) {
      try {
        currentEvents = await enrichEventsWeather({ events: currentEvents, base_weather: weather });
        setEvents(currentEvents);
      } catch {
        // fallback
      }
    }

    setMessages((prev) => {
      // 直前のメッセージがすでに schedule_settings カードであれば二重追加しない
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.attachment?.type === "schedule_settings") {
        return prev;
      }
      const schMsg: ChatMessage = {
        id: `ast_sch_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: `本日の予定（${currentEvents.length}件）です。予定の追加やGoogleカレンダー同期をここから行えます。`,
        attachment: {
          type: "schedule_settings",
          events: currentEvents,
          gcalStatus,
          isGCalLoading,
        },
        suggestedChips: ["今日のコーデを見る", "現在地にする", "服を確認する"],
      };
      return [...prev, schMsg];
    });
    scrollToBottom();
  };

  // チャットタイムラインに「手持ちクローゼットカード」を展開
  const handleOpenWardrobeInChat = (category?: ClothingCategory | "all") => {
    setMessages((prev) => {
      // 直前のメッセージがすでに wardrobe_view カードであれば二重追加しない
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.attachment?.type === "wardrobe_view") {
        return prev;
      }
      const dormantCount = wardrobe.filter((i) => i.days_since_last_worn >= 30).length;
      const utilizationRate =
        wardrobe.length === 0 ? 0 : Math.round(((wardrobe.length - dormantCount) / wardrobe.length) * 100);

      const wardrobeMsg: ChatMessage = {
        id: `ast_wardrobe_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: `手持ちのクローゼット（全${wardrobe.length}着・稼働率${utilizationRate}%）です。洗濯中ステータスの切り替えや登録、眠っている服のチェックができます。`,
        attachment: {
          type: "wardrobe_view",
          initialCategory: category || "all",
        },
        suggestedChips: ["今日のコーデを見る", "眠っている服を優先", "服を登録する"],
      };
      return [...prev, wardrobeMsg];
    });
    scrollToBottom();
  };

  // 予定の手動追加（時間・場所に応じたピンポイント気象を自動付与）
  const handleAddEvent = async (ev: RawCalendarEvent) => {
    let newEvents = [...events, ev].sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (weather) {
      try {
        newEvents = await enrichEventsWeather({ events: newEvents, base_weather: weather });
      } catch {
        // フォールバック
      }
    }
    setEvents(newEvents);
    if (weather) {
      executeRecommendation(
        weather,
        newEvents,
        profile,
        wardrobe,
        recentWornIds,
        `予定「${ev.title}」を追加しました。TPOと移動に合わせたコーディネートを再計算しました。`
      );
    }
  };

  // 予定の削除
  const handleDeleteEvent = (idx: number) => {
    const target = events[idx];
    const updated = events.filter((_, i) => i !== idx);
    setEvents(updated);
    if (weather) {
      executeRecommendation(
        weather,
        updated,
        profile,
        wardrobe,
        recentWornIds,
        target ? `予定「${target.title}」を削除しました。` : undefined
      );
    }
  };

  // ユーザーの自由テキスト送信処理（Tier 0 / Tier 1 / Tier 2）
  const handleUserSendMessage = async (text: string) => {
    const time = getNowTime();
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      timestamp: time,
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    setIsLoading(true);
    try {
      // 着用後体感フィードバックの直接入力ハンドリング（自然な会話としての入力）
      const targetOutfitForFb =
        latestOutfits.find((o) => o.rank === selectedOutfitRank) || latestOutfits[0];
      if (targetOutfitForFb && (text.includes("寒かった") || text.includes("冷えた"))) {
        setIsLoading(false);
        await handleComfortFeedback("cold", targetOutfitForFb, text, true);
        return;
      }
      if (
        targetOutfitForFb &&
        (text.includes("快適だった") || text.includes("ちょうどよかった") || (text.includes("快適") && !text.includes("不快")))
      ) {
        setIsLoading(false);
        await handleComfortFeedback("optimal", targetOutfitForFb, text, true);
        return;
      }
      if (targetOutfitForFb && (text.includes("暑かった") || text.includes("蒸れた"))) {
        setIsLoading(false);
        await handleComfortFeedback("warm", targetOutfitForFb, text, true);
        return;
      }

      const intentRes = await interpretChatMessage({
        message: text,
        context: {
          location_name: weather?.location_name || "東京・渋谷",
          cold_sensitivity: profile.cold_sensitivity,
          events_count: events.length,
          has_active_outfit: latestOutfits.length > 0,
          preferred_styles: profile.preferred_styles,
        },
      });

      // 意図に応じたアクション分岐
      if (intentRes.intent === "add_clothing_text" && intentRes.clothing_draft) {
        // テキストからの服追加ドラフト
        const draftMsg: ChatMessage = {
          id: `ast_${Date.now()}`,
          sender: "assistant",
          timestamp: getNowTime(),
          text: intentRes.assistant_message,
          attachment: {
            type: "clothing_draft",
            draft: intentRes.clothing_draft,
          },
          suggestedChips: intentRes.suggested_chips,
        };
        setMessages((prev) => [...prev, draftMsg]);
      } else if (intentRes.intent === "swap_item" && intentRes.target_category) {
        // アイテム部分入れ替え
        await handleOpenSwapModal(1, intentRes.target_category, latestOutfits[0]?.item_ids || []);
      } else if (intentRes.intent === "get_current_location") {
        // チャットからのGPS現在地取得
        handleTriggerGeolocationFromChat();
      } else if (intentRes.intent === "set_home_location") {
        // チャットからの居住区設定
        const target = intentRes.location_query || weather?.location_name;
        if (target) {
          handleSetHomeLocation(target);
        }
      } else if (intentRes.intent === "reset_to_home") {
        // チャットからの居住区復帰
        if (homeLocation) {
          await handleSelectCity(homeLocation);
        } else {
          const noHomeMsg: ChatMessage = {
            id: `ast_${Date.now()}`,
            sender: "assistant",
            timestamp: getNowTime(),
            text: "デフォルト居住区がまだ設定されていません。「世田谷を居住区にして」のように教えていただければ登録できます！",
            suggestedChips: ["東京・渋谷", "神奈川・横浜", "大阪・梅田"],
          };
          setMessages((prev) => [...prev, noHomeMsg]);
        }
      } else if (intentRes.intent === "show_schedule") {
        // チャットからの予定確認
        handleOpenScheduleInChat();
      } else if (intentRes.intent === "update_weather" && intentRes.location_query) {
        // 天気都市変更
        await handleSelectCity(intentRes.location_query);
      } else if (intentRes.intent === "update_sensitivity" && intentRes.cold_sensitivity !== undefined && intentRes.cold_sensitivity !== null) {
        // 寒がり/暑がり変更
        const nextProf = { ...profile, cold_sensitivity: intentRes.cold_sensitivity };
        setProfile(nextProf);
        if (weather) {
          await executeRecommendation(
            weather,
            events,
            nextProf,
            wardrobe,
            recentWornIds,
            intentRes.assistant_message
          );
        }
      } else if (intentRes.intent === "search_wardrobe" && intentRes.search_query) {
        // 1408次元ベクトル検索
        const searchResults = await searchWardrobeCrossModal({
          query: intentRes.search_query,
          wardrobe,
        });
        const searchMsg: ChatMessage = {
          id: `ast_${Date.now()}`,
          sender: "assistant",
          timestamp: getNowTime(),
          text: intentRes.assistant_message,
          attachment: {
            type: "search_results",
            query: intentRes.search_query,
            results: searchResults,
          },
          suggestedChips: intentRes.suggested_chips,
        };
        setMessages((prev) => [...prev, searchMsg]);
      } else if (intentRes.intent === "open_closet") {
        handleOpenWardrobeInChat();
      } else if (intentRes.intent === "recommend") {
        // 再推薦
        const nextProf = intentRes.preferred_styles
          ? { ...profile, preferred_styles: intentRes.preferred_styles }
          : profile;
        setProfile(nextProf);
        if (weather) {
          await executeRecommendation(
            weather,
            events,
            nextProf,
            wardrobe,
            recentWornIds,
            intentRes.assistant_message
          );
        }
      } else {
        // 一般返答
        const generalMsg: ChatMessage = {
          id: `ast_${Date.now()}`,
          sender: "assistant",
          timestamp: getNowTime(),
          text: intentRes.assistant_message,
          suggestedChips: intentRes.suggested_chips,
        };
        setMessages((prev) => [...prev, generalMsg]);
      }

      if (intentRes.suggested_chips && intentRes.suggested_chips.length > 0) {
        setSuggestedChips(intentRes.suggested_chips);
      }
    } catch (err) {
      setErrorMsg("対話の解析に失敗しました。");
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // 選択肢チップのタップ（Tier 0: LLMコスト0円で直結実行）
  const handleSelectChip = async (chipText: string) => {
    if (chipText.includes("明日のコーデ") || chipText.includes("明日何着る") || chipText.includes("新しい基準") || chipText.includes("次のコーデ")) {
      handleUserSendMessage("明日のコーデを見せて");
      return;
    }
    if (chipText.includes("寒かった")) {
      const target = latestOutfits.find((o) => o.rank === selectedOutfitRank) || latestOutfits[0];
      if (target) {
        await handleComfortFeedback("cold", target);
        return;
      }
    }
    if (chipText.includes("快適")) {
      const target = latestOutfits.find((o) => o.rank === selectedOutfitRank) || latestOutfits[0];
      if (target) {
        await handleComfortFeedback("optimal", target);
        return;
      }
    }
    if (chipText.includes("暑かった")) {
      const target = latestOutfits.find((o) => o.rank === selectedOutfitRank) || latestOutfits[0];
      if (target) {
        await handleComfortFeedback("warm", target);
        return;
      }
    }
    if (chipText.includes("今日これを着る")) {
      if (latestOutfits.length > 0) {
        await handleWearOutfit(latestOutfits[0]);
      }
      return;
    }
    if (chipText.includes("眠っている服")) {
      handleUserSendMessage("眠っている服を優先してコーデ組んで");
      return;
    }
    if (chipText.includes("靴だけ変える") || chipText.includes("スニーカー") || chipText.includes("ローファー")) {
      handleUserSendMessage("靴を変えたい");
      return;
    }
    if (chipText.includes("アウターを変える") || chipText.includes("コート")) {
      handleUserSendMessage("アウターを変えたい");
      return;
    }
    if (chipText.includes("少し暖かく") || chipText.includes("寒がり")) {
      handleUserSendMessage("寒がりなので暖かくして");
      return;
    }
    if (chipText.includes("服を登録") || chipText.includes("服を追加")) {
      const msg: ChatMessage = {
        id: `ast_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: "下のカメラボタン 📷 から服の写真を送るか、「黒のタートルネックニット追加」「撥水のローファー買った」のようにテキストを送っていただければ、被服気候学属性を抽出して登録できます！",
        suggestedChips: ["📷 写真を選択する", "黒のニットを追加", "撥水の靴を追加"],
      };
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
      return;
    }
    if (chipText.includes("現在地")) {
      handleTriggerGeolocationFromChat();
      return;
    }
    if (chipText.includes("居住区に戻す") || chipText.includes("自宅に戻す")) {
      if (homeLocation) {
        handleSelectCity(homeLocation);
      } else {
        handleUserSendMessage(chipText);
      }
      return;
    }
    if (chipText.includes("カレンダー連携") || chipText.includes("予定")) {
      handleOpenScheduleInChat();
      return;
    }
    if (chipText.includes("場所設定") || chipText.includes("場所変更") || chipText.includes("場所カード")) {
      handleOpenLocationInChat();
      return;
    }
    if (
      chipText.includes("クローゼット") ||
      chipText.includes("手持ち服") ||
      chipText.includes("服を確認") ||
      chipText.includes("服一覧")
    ) {
      handleOpenWardrobeInChat();
      return;
    }
    // その他のチップはそのまま自然言語として送信
    handleUserSendMessage(chipText);
  };

  // 写真アップロード処理（チャットから手持ち服登録）
  const handleSendPhoto = async (file: File) => {
    setIsLoading(true);
    try {
      // クライアント側で軽量化 & Base64 DataURL 生成（リロードしても画像が消えない永続化対応）
      const { compressedFile, dataUrl } = await compressImage(file);
      const time = getNowTime();

      const userPhotoMsg: ChatMessage = {
        id: `usr_${Date.now()}`,
        sender: "user",
        timestamp: time,
        text: "服の写真を送信しました",
        imageUrl: dataUrl,
      };
      setMessages((prev) => [...prev, userPhotoMsg]);
      scrollToBottom();

      const analyzed = await analyzeClothingPhoto(compressedFile);
      const draftMsg: ChatMessage = {
        id: `ast_draft_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: `「${analyzed.suggested_name}」（${CATEGORY_LABELS[analyzed.category]} / ${analyzed.clo_value} Clo）をマルチモーダル解析しました！内容を確認してクローゼットに登録してください。`,
        attachment: {
          type: "clothing_draft",
          draft: analyzed,
          imageUrl: dataUrl,
        },
        suggestedChips: ["✨ クローゼットに登録", "別の写真を送る", "今日のコーデに戻る"],
      };
      setMessages((prev) => [...prev, draftMsg]);
    } catch (err) {
      setErrorMsg("写真の解析に失敗しました。");
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // ドラフト服の確定登録処理
  const handleConfirmAddClothing = async (draft: AnalyzeClothingResponse, imageUrl?: string | null) => {
    const newItem: ClothingItem = {
      id: `item_${Date.now()}`,
      name: draft.suggested_name,
      category: draft.category,
      subtype: draft.subtype,
      colors: draft.colors,
      formality: draft.formality,
      clo_value: draft.clo_value,
      water_resistant: draft.water_resistant,
      wear_count: 0,
      days_since_last_worn: 30, // 即座に新着・死蔵ブースト対象に
      availability: "available",
      image_url: imageUrl || null,
      style_tags: draft.style_tags,
    };

    const updated = [newItem, ...wardrobe];
    setWardrobe(updated);
    await saveWardrobe(updated);

    const time = getNowTime();
    const confirmedMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      sender: "assistant",
      timestamp: time,
      text: `🎉「${newItem.name}」をクローゼットに追加しました！（手持ち服: 全${updated.length}着）この服を組み込んだ新しいコーディネートを計算します。`,
    };
    setMessages((prev) => [...prev, confirmedMsg]);

    if (weather) {
      await executeRecommendation(
        weather,
        events,
        profile,
        updated,
        recentWornIds,
        `追加された「${newItem.name}」を活かした新しい3つのコーディネート提案です！`
      );
    }
  };

  // アイテム部分入れ替え (Swap) モーダル/カード展開
  const handleOpenSwapModal = async (
    outfitRank: number,
    targetCategory: ClothingCategory,
    currentItemIds: string[]
  ) => {
    if (!weather || !latestTrace) return;
    setIsLoading(true);
    try {
      const candidates = await fetchSwapCandidates({
        target_category: targetCategory,
        current_item_ids: currentItemIds,
        target_clo_min: latestTrace.target_clo_min,
        target_clo_max: latestTrace.target_clo_max,
        weather,
        profile,
        wardrobe,
      });

      const swapMsg: ChatMessage = {
        id: `swap_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: `【Option 0${outfitRank}】${CATEGORY_LABELS[targetCategory]}の差し替え候補です。被服気候学の目標断熱性（${latestTrace.target_clo_min}〜${latestTrace.target_clo_max} Clo）を崩さない手持ち服を厳選しました。`,
        attachment: {
          type: "swap_candidates",
          targetCategory,
          candidates,
          outfitRank,
        },
      };
      setMessages((prev) => [...prev, swapMsg]);
      scrollToBottom();
    } catch {
      setErrorMsg("差し替え候補の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  // 差し替えの適用
  const handleApplySwap = (newItem: ClothingItem, outfitRank: number) => {
    const target = latestOutfits.find((o) => o.rank === outfitRank);
    if (!target) return;

    const newItems = target.items.map((i) => (i.category === newItem.category ? newItem : i));
    if (!newItems.some((i) => i.category === newItem.category)) newItems.push(newItem);

    const newTotalClo = Math.round((newItems.reduce((acc, i) => acc + i.clo_value, 0.06)) * 100) / 100;
    const revived = newItems.filter((i) => i.days_since_last_worn >= 30).map((i) => i.id);

    const updatedOutfits = latestOutfits.map((o) => {
      if (o.rank !== outfitRank) return o;
      return {
        ...o,
        item_ids: newItems.map((i) => i.id),
        items: newItems,
        total_clo: newTotalClo,
        revived_dormant_ids: revived,
        reason: `${newItem.name} にカスタム差し替え。熱的断熱性 ${newTotalClo} Clo で快適性を維持。`,
      };
    });
    setLatestOutfits(updatedOutfits);

    const appliedMsg: ChatMessage = {
      id: `ast_swap_${Date.now()}`,
      sender: "assistant",
      timestamp: getNowTime(),
      text: `Option 0${outfitRank} を「${newItem.name}」に差し替えました！（合計 ${newTotalClo} Clo）`,
      attachment: {
        type: "outfits",
        outfits: updatedOutfits,
        trace: latestTrace,
        selectedOutfitRank,
      },
    };
    setMessages((prev) => [...prev, appliedMsg]);
    scrollToBottom();
  };

  // Google Calendar 着用コーデ書き込み & Firestore 永続化
  const handleWearOutfit = async (proposal: OutfitProposal) => {
    setSelectedOutfitRank(proposal.rank);
    setFeedbackSubmittedRank(null);
    setIsCalendarSaving(true);

    // 1. ユーザーの発話吹き出しをチャットに追加（自然な会話体験）
    const userMsg: ChatMessage = {
      id: `usr_wear_${Date.now()}`,
      sender: "user",
      timestamp: getNowTime(),
      text: `今日のコーデは「${proposal.title}」にする！👔`,
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    const updatedWardrobe = wardrobe.map((item) =>
      proposal.item_ids.includes(item.id)
        ? { ...item, wear_count: item.wear_count + 1, days_since_last_worn: 0 }
        : item
    );
    setWardrobe(updatedWardrobe);
    await saveWardrobe(updatedWardrobe);
    setRecentWornIds(proposal.item_ids);

    // バックエンド（Firestore / 永続層）に着用履歴を保存
    try {
      await recordOutfitWear({
        item_ids: proposal.item_ids,
        total_clo: proposal.total_clo,
        weather_location: weather?.location_name,
      });
    } catch (e) {
      console.warn("recordOutfitWear background error:", e);
    }

    const chosenItems = wardrobe.filter((i) => proposal.item_ids.includes(i.id));
    const titleCore = chosenItems.map((i) => i.name).slice(0, 2).join(" × ");
    const eventTitle = `👔 [Closet Me] ${titleCore}`;
    const itemsSummaryText = chosenItems.map((i) => `${CATEGORY_LABELS[i.category]}: ${i.name}`).join(" / ");

    const descriptionLines = [
      "【着用アイテム】",
      ...chosenItems.map((i) => `・${CATEGORY_LABELS[i.category]}: ${i.name} (${i.clo_value} Clo)`),
      "",
      `合計断熱性: ${proposal.total_clo} Clo`,
      `推薦理由: ${proposal.reason}`,
      proposal.weather_advice ? `気候助言: ${proposal.weather_advice}` : "",
    ].filter(Boolean);

    try {
      if (gcalAccessToken) {
        const res = await createGoogleCalendarOutfitEvent(gcalAccessToken, {
          title: eventTitle,
          itemsSummary: itemsSummaryText,
          descriptionLines,
        });
        const savedMsg: ChatMessage = {
          id: `ast_cal_${Date.now()}`,
          sender: "assistant",
          timestamp: getNowTime(),
          text: `決まりましたね！本日のコーディネート「${proposal.title}」を Google カレンダーに終日記録しました 🎉\n\n一日過ごしてみて、体感がどうだったか下のボタンから教えてくださいね（寒かった・快適・暑かった）。あなたの体感を学習して、次回の提案がどんどんあなた専用に賢くなっていきます 😊`,
          attachment: {
            type: "calendar_saved",
            title: eventTitle,
            htmlLink: res.htmlLink,
            outfit: proposal,
          },
        };
        setMessages((prev) => [...prev, savedMsg]);
      } else {
        const templateUrl = generateGoogleCalendarTemplateUrl({
          title: eventTitle,
          itemsSummary: itemsSummaryText,
          descriptionLines,
        });
        const savedMsg: ChatMessage = {
          id: `ast_cal_${Date.now()}`,
          sender: "assistant",
          timestamp: getNowTime(),
          text: `決まりましたね！本日のコーディネート「${proposal.title}」を記録しました 🎉\nGoogleカレンダー本体へも1クリックで追加できます。\n\n一日過ごしてみて、体感がどうだったか下のボタンから教えてくださいね（寒かった・快適・暑かった）。あなたの体感を学習して、次回の提案がどんどんあなた専用に賢くなっていきます 😊`,
          attachment: {
            type: "calendar_saved",
            title: eventTitle,
            templateUrl,
            outfit: proposal,
          },
        };
        setMessages((prev) => [...prev, savedMsg]);
      }
    } catch {
      setErrorMsg("カレンダーへの記録に失敗しました。");
    } finally {
      setIsCalendarSaving(false);
      setSuggestedChips(["🥶 寒かった", "😊 快適だった", "🥵 暑かった"]);
      scrollToBottom();
    }
  };

  // 着用後の1タップ体感フィードバック（寒い/快適/暑い）による個人Clo自己学習
  const handleComfortFeedback = async (
    feedback: "cold" | "optimal" | "warm",
    proposal: OutfitProposal,
    customUserText?: string,
    alreadyAddedUserMsg: boolean = false
  ) => {
    try {
      setFeedbackSubmittedRank(proposal.rank);

      // ユーザーの発話吹き出しを追加（未追加の場合）
      if (!alreadyAddedUserMsg) {
        const userFeedbackText =
          customUserText ||
          (feedback === "cold"
            ? "今日はちょっと寒かったかも 🥶"
            : feedback === "optimal"
            ? "今日のコーデ、ちょうどよくて快適だった！ 😊"
            : "今日は少し暑かったかも 🥵");

        const userMsg: ChatMessage = {
          id: `usr_fb_${Date.now()}`,
          sender: "user",
          timestamp: getNowTime(),
          text: userFeedbackText,
        };
        setMessages((prev) => [...prev, userMsg]);
        scrollToBottom();
      }

      const res = await submitComfortFeedback({
        feedback,
        worn_item_ids: proposal.item_ids,
        actual_total_clo: proposal.total_clo,
        weather_temp_c: weather?.afternoon_temp_c,
      });

      const nextProf = {
        ...profile,
        personal_clo_offset: res.updated_offset,
        feedback_count: res.feedback_count,
      };
      setProfile(nextProf);

      const offsetDisplay = `${res.updated_offset > 0 ? "+" : ""}${res.updated_offset}`;

      // スタイリストAIの温かみのある対話返答
      let assistantDialogue = "";
      if (feedback === "cold") {
        assistantDialogue = `教えてくれてありがとうございます！少し肌寒かったんですね ☕\n\nあなたの体感を学習して、次回からは少し暖かめの組み合わせ（断熱性 +0.08 Clo）を優先するように調整しました 🧣\n着るたびに、あなたにぴったりのパーソナルスタイリストへ育っていきます！`;
      } else if (feedback === "optimal") {
        assistantDialogue = `よかったです！今日の気温と予定にぴったり合っていたようで嬉しいです ✨\n\nこの心地よい基準（断熱性 ±0.00 Clo）をあなたのベストバランスとして大切にキープしておきますね 😊`;
      } else {
        assistantDialogue = `教えてくれてありがとうございます！思ったより暖かくて暑かったんですね ☀️\n\n次回からはより軽快で風通しの良い組み合わせ（断熱性 -0.08 Clo）を優先するように調整しました 🌿\n次回の提案を楽しみにしていてくださいね！`;
      }

      const fbMsg: ChatMessage = {
        id: `ast_fb_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: `${assistantDialogue}\n\n💡 個人学習記録: 体感オフセット ${offsetDisplay} Clo に更新（フィードバック通算 ${res.feedback_count}回目・Cloud Firestore同期済）`,
        suggestedChips: ["明日のコーデを見る", "眠っている服を優先", "手持ちの服を確認"],
      };
      setMessages((prev) => [...prev, fbMsg]);
      setSuggestedChips(["明日のコーデを見る", "眠っている服を優先", "手持ちの服を確認"]);
      scrollToBottom();
    } catch (err) {
      setErrorMsg("体感フィードバックの記録に失敗しました。");
    }
  };

  // Google Calendar 接続
  const handleConnectGoogleCalendar = async (forceDemo: boolean = false) => {
    setIsGCalLoading(true);
    try {
      if (!forceDemo && isGoogleAuthAvailable()) {
        const token = await getGoogleCalendarAccessToken();
        setGcalAccessToken(token);
        let evs = await fetchGoogleCalendarEvents(token);
        if (weather) {
          try {
            evs = await enrichEventsWeather({ events: evs, base_weather: weather });
          } catch {
            // fallback
          }
        }
        setEvents(evs);
        setGcalStatus("connected_real");
        if (weather) {
          await executeRecommendation(weather, evs, profile, wardrobe, recentWornIds, "Google カレンダーの本番予定を同期しました！");
        }
      } else {
        let demoEvs = getSimulatedGoogleEvents();
        if (weather) {
          try {
            demoEvs = await enrichEventsWeather({ events: demoEvs, base_weather: weather });
          } catch {
            // fallback
          }
        }
        setEvents(demoEvs);
        setGcalStatus("connected_demo");
        if (weather) {
          await executeRecommendation(weather, demoEvs, profile, wardrobe, recentWornIds, "【デモ連携】Google カレンダーから本日の予定（4件）を同期しました。");
        }
      }
    } catch {
      setErrorMsg("Google カレンダー連携に失敗しました。");
    } finally {
      setIsGCalLoading(false);
    }
  };

  const handleDisconnectGoogleCalendar = () => {
    setGcalStatus("disconnected");
    setGcalAccessToken(null);
    const preset = presets.find((p) => p.id === selectedPresetId) || presets[0];
    if (preset) {
      setEvents(preset.events);
      if (weather) executeRecommendation(weather, preset.events, profile, wardrobe, recentWornIds);
    }
  };

  const handleToggleLaundry = async (itemId: string) => {
    const updated = wardrobe.map((i) =>
      i.id === itemId
        ? { ...i, availability: (i.availability === "available" ? "laundry" : "available") as "available" | "laundry" }
        : i
    );
    setWardrobe(updated);
    await saveWardrobe(updated);
    if (weather) executeRecommendation(weather, events, profile, updated, recentWornIds);
  };

  // 服の削除（手持ち服から除外）
  const handleDeleteItem = async (itemId: string) => {
    const target = wardrobe.find((i) => i.id === itemId);
    const updated = wardrobe.filter((i) => i.id !== itemId);
    setWardrobe(updated);
    await saveWardrobe(updated);
    setSelectedItemDetail(null);

    const time = getNowTime();
    const deleteMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      sender: "assistant",
      timestamp: time,
      text: `「${target?.name || "アイテム"}」をクローゼットから削除しました（残り${updated.length}着）。最新の組み合わせを再計算します。`,
    };
    setMessages((prev) => [...prev, deleteMsg]);

    if (weather) {
      await executeRecommendation(
        weather,
        events,
        profile,
        updated,
        recentWornIds.filter((id) => id !== itemId)
      );
    }
  };

  // デモ服へのリセット
  const handleResetToDemo = async () => {
    await clearSavedWardrobe();
    const ctx = await fetchDemoContext();
    setWardrobe(ctx.wardrobe);

    const time = getNowTime();
    const resetMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      sender: "assistant",
      timestamp: time,
      text: "クローゼットを初期のデモデータ（12着）にリセットしました。",
    };
    setMessages((prev) => [...prev, resetMsg]);

    if (weather) {
      await executeRecommendation(
        weather,
        events,
        profile,
        ctx.wardrobe,
        [],
        "初期デモデータでコーディネートを再計算しました！"
      );
    }
  };

  // 手動での服追加
  const handleManualAddClothing = async (item: ClothingItem) => {
    const updated = [item, ...wardrobe];
    setWardrobe(updated);
    await saveWardrobe(updated);

    const time = getNowTime();
    const addedMsg: ChatMessage = {
      id: `ast_${Date.now()}`,
      sender: "assistant",
      timestamp: time,
      text: `🎉「${item.name}」を手動追加しました！（全${updated.length}着）この服を含めたコーディネートを提案します。`,
    };
    setMessages((prev) => [...prev, addedMsg]);

    if (weather) {
      await executeRecommendation(
        weather,
        events,
        profile,
        updated,
        recentWornIds,
        `新しく追加した「${item.name}」を取り入れたおすすめコーデです！`
      );
    }
  };

  const utilizationRate = useMemo(() => {
    if (wardrobe.length === 0) return 0;
    const dormant = wardrobe.filter((i) => i.days_since_last_worn >= 30).length;
    return Math.round(((wardrobe.length - dormant) / wardrobe.length) * 100);
  }, [wardrobe]);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-xs">
              <Shirt className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-zinc-100" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight">Closet Me</h1>
              <p className="text-[10px] text-zinc-500 hidden sm:block">
                被服気候学(Clo値) × パーソナルスタイリスト
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {/* 稼働率バッジ */}
            <div
              onClick={() => handleOpenWardrobeInChat()}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 cursor-pointer hover:bg-zinc-100 transition"
              title="チャットでクローゼット一覧を開く"
            >
              <span>稼働率 {utilizationRate}%</span>
            </div>

            {/* 場所・天気ボタン（チャットに気象設定カードを展開） */}
            <button
              onClick={handleOpenLocationInChat}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-800 transition shadow-2xs"
              title="チャットで場所・気象設定を開く"
            >
              {homeLocation && weather?.location_name && weather.location_name.includes(homeLocation) ? (
                <Home className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
              ) : (
                <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              <span className="max-w-[70px] sm:max-w-[100px] truncate">{weather?.location_name || "地域未設定"}</span>
              {weather && (
                <span className="text-zinc-500 font-medium text-[11px] shrink-0">
                  {weather.afternoon_temp_c}℃
                </span>
              )}
            </button>

            {/* Google カレンダー予定ボタン（チャットに予定カードを展開） */}
            <button
              onClick={handleOpenScheduleInChat}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition shadow-2xs ${
                gcalStatus !== "disconnected"
                  ? "border-zinc-300 bg-zinc-50 text-zinc-900 hover:bg-zinc-100"
                  : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 hover:border-zinc-300"
              }`}
              title="チャットで予定一覧を開く"
            >
              <Calendar className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
              <span>予定 {events.length}件</span>
              {gcalStatus !== "disconnected" && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            {/* 手持ち服ボタン */}
            <button
              onClick={() => handleOpenWardrobeInChat()}
              className="flex items-center gap-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-800 transition cursor-pointer"
              title="チャットで手持ち服一覧を開く"
            >
              <Shirt className="h-3.5 w-3.5 text-zinc-600" />
              <span>服 ({wardrobe.length})</span>
            </button>
          </div>
        </div>

        {/* 1-Click 検証シナリオバー */}
        {presets.length > 0 && (
          <div className="border-t border-zinc-100 bg-zinc-50/70 px-3 py-1.5 sm:px-4">
            <div className="mx-auto max-w-4xl flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[10px] shrink-0">
                1-Click デモ検証
              </span>
              <select
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="flex-1 max-w-md rounded-lg border border-zinc-300 bg-white px-2 py-0.8 text-xs font-medium text-zinc-800 focus:outline-none cursor-pointer truncate"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      {/* エラーバナー */}
      {errorMsg && (
        <div className="mx-auto max-w-4xl px-3 pt-2 w-full">
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 rounded">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Timeline */}
      <main className="flex-1 flex flex-col justify-between">
        <ChatMessageList
          messages={messages}
          onOpenSwap={handleOpenSwapModal}
          onApplySwap={handleApplySwap}
          onWearOutfit={handleWearOutfit}
          onConfirmAddClothing={handleConfirmAddClothing}
          onItemDetail={(item) => setSelectedItemDetail(item)}
          onOpenLocationModal={handleOpenLocationInChat}
          onOpenClosetDrawer={() => handleOpenWardrobeInChat()}
          onSelectCity={handleSelectCity}
          onGetLocation={handleTriggerGeolocationFromChat}
          onSetHomeLocation={handleSetHomeLocation}
          onAddEvent={handleAddEvent}
          onDeleteEvent={handleDeleteEvent}
          onConnectGoogleCalendar={handleConnectGoogleCalendar}
          onDisconnectGoogleCalendar={handleDisconnectGoogleCalendar}
          isGCalLoading={isGCalLoading}
          selectedOutfitRank={selectedOutfitRank}
          isCalendarSaving={isCalendarSaving}
          isLoading={isLoading}
          wardrobe={wardrobe}
          onToggleLaundry={handleToggleLaundry}
          onDeleteItem={handleDeleteItem}
          onResetToDemo={handleResetToDemo}
          onTriggerPhotoUpload={() => handleSelectChip("服を登録する")}
          onAddManualItem={handleManualAddClothing}
          onComfortFeedback={handleComfortFeedback}
          feedbackSubmittedRank={feedbackSubmittedRank}
        />
        <div ref={chatBottomRef} />
      </main>

      {/* Bottom Sticky Composer */}
      <ChatComposer
        onSendMessage={handleUserSendMessage}
        onSendPhoto={handleSendPhoto}
        onGetLocation={handleTriggerGeolocationFromChat}
        onSelectChip={handleSelectChip}
        suggestedChips={suggestedChips}
        disabled={isLoading}
      />

      {/* 場所・気象設定モーダル */}
      <LocationWeatherModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        weather={weather}
        profile={profile}
        homeLocation={homeLocation}
        destinationLocation={destinationLocation}
        umbrellaType={latestOutfits[0]?.umbrella_type || "none"}
        umbrellaAdvice={latestOutfits[0]?.umbrella_advice}
        isLoadingWeather={isLoadingWeather}
        onSelectCity={handleSelectCity}
        onSelectCoords={handleSelectCoords}
        onSetHomeLocation={handleSetHomeLocation}
        onSensitivityChange={(delta) => {
          const nextProf = { ...profile, cold_sensitivity: delta };
          setProfile(nextProf);
          if (weather) executeRecommendation(weather, events, nextProf, wardrobe, recentWornIds);
        }}
      />

      {/* Google カレンダー & 予定管理ドロワー */}
      <CalendarDrawer
        isOpen={isCalendarDrawerOpen}
        onClose={() => setIsCalendarDrawerOpen(false)}
        events={events}
        gcalStatus={gcalStatus}
        isGCalLoading={isGCalLoading}
        onConnectGoogleCalendar={handleConnectGoogleCalendar}
        onDisconnectGoogleCalendar={handleDisconnectGoogleCalendar}
        onAddEvent={handleAddEvent}
        onDeleteEvent={handleDeleteEvent}
      />

      {/* 衣服詳細モーダル */}
      {selectedItemDetail && (
        <div
          onClick={() => setSelectedItemDetail(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {CATEGORY_LABELS[selectedItemDetail.category]}
              </span>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedItemDetail.image_url && (
              <div className="aspect-4/3 w-full rounded-xl overflow-hidden bg-zinc-100">
                <img
                  src={selectedItemDetail.image_url}
                  alt={selectedItemDetail.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div>
              <h4 className="text-sm font-bold text-zinc-900">{selectedItemDetail.name}</h4>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {selectedItemDetail.colors.join("・")} | {selectedItemDetail.style_tags.join(", ") || "ベーシック"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-zinc-50 p-2 border border-zinc-100">
                <span className="text-[9px] text-zinc-400 block">断熱性</span>
                <span className="font-mono font-bold text-xs">{selectedItemDetail.clo_value} Clo</span>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2 border border-zinc-100">
                <span className="text-[9px] text-zinc-400 block">フォーマル</span>
                <span className="font-bold text-xs">Lv.{selectedItemDetail.formality}</span>
              </div>
              <div className="rounded-xl bg-zinc-50 p-2 border border-zinc-100">
                <span className="text-[9px] text-zinc-400 block">未着用</span>
                <span className="font-bold text-xs text-amber-600">
                  {selectedItemDetail.days_since_last_worn}日前
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  if (window.confirm(`「${selectedItemDetail.name}」を手持ち服から削除しますか？`)) {
                    handleDeleteItem(selectedItemDetail.id);
                  }
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition cursor-pointer"
                title="この服を削除"
              >
                <Trash2 className="h-4 w-4" />
                <span>削除</span>
              </button>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
