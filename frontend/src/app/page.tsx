"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Compass,
  MapPin,
  Plus,
  RefreshCw,
  Shirt,
  X,
} from "lucide-react";
import {
  analyzeClothingPhoto,
  fetchDemoContext,
  fetchSwapCandidates,
  interpretChatMessage,
  lookupWeather,
  requestRecommendations,
  searchWardrobeCrossModal,
} from "@/lib/apiClient";
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
import { ClosetDrawer } from "@/components/drawers/ClosetDrawer";
import { ContextDrawer } from "@/components/drawers/ContextDrawer";

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
  const [latestOutfits, setLatestOutfits] = useState<OutfitProposal[]>([]);
  const [latestTrace, setLatestTrace] = useState<PipelineTrace | null>(null);

  // Google Calendar 状態
  const [gcalStatus, setGcalStatus] = useState<"disconnected" | "connected_real" | "connected_demo">("disconnected");
  const [gcalAccessToken, setGcalAccessToken] = useState<string | null>(null);
  const [isGCalLoading, setIsGCalLoading] = useState<boolean>(false);
  const [isCalendarSaving, setIsCalendarSaving] = useState<boolean>(false);

  // ドロワー開閉状態
  const [isClosetDrawerOpen, setIsClosetDrawerOpen] = useState(false);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<ClothingItem | null>(null);

  // チャットタイムライン状態
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestedChips, setSuggestedChips] = useState<string[]>([
    "今日のコーデを見る",
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
        const res = await requestRecommendations({
          weather: w,
          events: ev,
          profile: prof,
          wardrobe: items,
          recent_worn_ids: recent,
        });
        setLatestOutfits(res.outfits);
        setLatestTrace(res.trace);
        setSelectedOutfitRank(null);

        const time = getNowTime();
        const intro = customIntroText || (
          `おはようございます！今日の${w.location_name}の天気（最高${w.afternoon_temp_c}℃ / 降水確率${Math.round(w.rain_probability * 100)}%）と、予定（${ev.length}件）に合わせて、被服気候学（目標 ${res.trace.target_clo_min}〜${res.trace.target_clo_max} Clo）に基づいた3つのコーディネートを最適化しました。`
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
    (async () => {
      try {
        setIsLoading(true);
        const ctx = await fetchDemoContext();
        setWardrobe(ctx.wardrobe);
        setPresets(ctx.presets);

        if (ctx.presets.length > 0) {
          const first = ctx.presets[0];
          setSelectedPresetId(first.id);
          setWeather(first.weather);
          setEvents(first.events);
          setProfile(first.profile);

          // 1. 朝のブリーフィングカードを投稿
          const briefingMsg: ChatMessage = {
            id: `msg_briefing_${Date.now()}`,
            sender: "assistant",
            timestamp: getNowTime(),
            text: `Closet Me へようこそ！今日の予定と天候を読み込みました。`,
            attachment: {
              type: "briefing",
              weather: first.weather,
              events: first.events,
            },
          };
          setMessages([briefingMsg]);

          // 2. 本日の3コーデ提案を自動生成
          await executeRecommendation(
            first.weather,
            first.events,
            first.profile,
            ctx.wardrobe,
            [],
            `本日の予定（${first.events.map((e) => e.title).join("・")}）に合わせた、熱的快適性と死蔵服復活を両立する3案です！`
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
      } else if (intentRes.intent === "update_weather" && intentRes.location_query) {
        // 天気都市変更
        const newWeather = await lookupWeather(intentRes.location_query);
        setWeather(newWeather);
        if (weather) {
          await executeRecommendation(
            newWeather,
            events,
            profile,
            wardrobe,
            recentWornIds,
            `${intentRes.location_query}の最新天気に更新しました！実効気温に合わせた新しい提案です。`
          );
        }
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
        setIsClosetDrawerOpen(true);
        const replyMsg: ChatMessage = {
          id: `ast_${Date.now()}`,
          sender: "assistant",
          timestamp: getNowTime(),
          text: intentRes.assistant_message,
          suggestedChips: intentRes.suggested_chips,
        };
        setMessages((prev) => [...prev, replyMsg]);
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
    if (chipText.includes("今日これを着る")) {
      if (latestOutfits.length > 0) {
        await handleWearOutfit(latestOutfits[0]);
      }
      return;
    }
    if (chipText.includes("眠っている服")) {
      handleUserSendMessage("眠っている死蔵服を優先してコーデ組んで");
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
    if (chipText.includes("カレンダー連携")) {
      setIsContextDrawerOpen(true);
      return;
    }
    if (chipText.includes("クローゼット")) {
      setIsClosetDrawerOpen(true);
      return;
    }
    // その他のチップはそのまま自然言語として送信
    handleUserSendMessage(chipText);
  };

  // 写真アップロード処理（チャットから手持ち服登録）
  const handleSendPhoto = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const time = getNowTime();

    const userPhotoMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      timestamp: time,
      text: "服の写真を送信しました",
      imageUrl: previewUrl,
    };
    setMessages((prev) => [...prev, userPhotoMsg]);
    scrollToBottom();

    setIsLoading(true);
    try {
      const analyzed = await analyzeClothingPhoto(file);
      const draftMsg: ChatMessage = {
        id: `ast_draft_${Date.now()}`,
        sender: "assistant",
        timestamp: getNowTime(),
        text: `「${analyzed.suggested_name}」（${CATEGORY_LABELS[analyzed.category]} / ${analyzed.clo_value} Clo）をマルチモーダル解析しました！内容を確認してクローゼットに登録してください。`,
        attachment: {
          type: "clothing_draft",
          draft: analyzed,
          imageUrl: previewUrl,
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

  // Google Calendar 着用コーデ書き込み
  const handleWearOutfit = async (proposal: OutfitProposal) => {
    setSelectedOutfitRank(proposal.rank);
    setIsCalendarSaving(true);

    const updatedWardrobe = wardrobe.map((item) =>
      proposal.item_ids.includes(item.id)
        ? { ...item, wear_count: item.wear_count + 1, days_since_last_worn: 0 }
        : item
    );
    setWardrobe(updatedWardrobe);
    setRecentWornIds(proposal.item_ids);

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
          text: `🎉 本日のコーディネート「${proposal.title}」を Google カレンダーに終日記録しました！`,
          attachment: {
            type: "calendar_saved",
            title: eventTitle,
            htmlLink: res.htmlLink,
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
          text: `🎉 本日のコーディネート「${proposal.title}」を記録しました！Googleカレンダー本体へも1クリックで追加できます。`,
          attachment: {
            type: "calendar_saved",
            title: eventTitle,
            templateUrl,
          },
        };
        setMessages((prev) => [...prev, savedMsg]);
      }
    } catch {
      setErrorMsg("カレンダーへの記録に失敗しました。");
    } finally {
      setIsCalendarSaving(false);
      scrollToBottom();
    }
  };

  // Google Calendar 接続
  const handleConnectGoogleCalendar = async (forceDemo: boolean = false) => {
    setIsGCalLoading(true);
    try {
      if (!forceDemo && isGoogleAuthAvailable()) {
        const token = await getGoogleCalendarAccessToken();
        setGcalAccessToken(token);
        const evs = await fetchGoogleCalendarEvents(token);
        setEvents(evs);
        setGcalStatus("connected_real");
        if (weather) {
          await executeRecommendation(weather, evs, profile, wardrobe, recentWornIds, "Google カレンダーの本番予定を同期しました！");
        }
      } else {
        const demoEvs = getSimulatedGoogleEvents();
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

  const handleToggleLaundry = (itemId: string) => {
    const updated = wardrobe.map((i) =>
      i.id === itemId
        ? { ...i, availability: (i.availability === "available" ? "laundry" : "available") as "available" | "laundry" }
        : i
    );
    setWardrobe(updated);
    if (weather) executeRecommendation(weather, events, profile, updated, recentWornIds);
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-xs">
              <Shirt className="h-4.5 w-4.5 text-zinc-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight">Closet Me</h1>
                <span className="rounded-full bg-zinc-100 px-2 py-0.2 text-[10px] font-bold text-zinc-600">
                  DevFest 2026
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 hidden sm:block">
                被服気候学(Clo値) × パーソナルスタイリスト
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {/* 稼働率バッジ */}
            <div
              onClick={() => setIsClosetDrawerOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-xs font-bold text-emerald-800 cursor-pointer hover:bg-emerald-100 transition"
              title="クローゼット一覧を開く"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>稼働率 {utilizationRate}%</span>
            </div>

            {/* 天気・予定ピル */}
            <button
              onClick={() => setIsContextDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-400 transition"
            >
              <MapPin className="h-3.5 w-3.5 text-zinc-500" />
              <span className="max-w-[70px] sm:max-w-none truncate">{weather?.location_name || "地域未設定"}</span>
              <span className="text-zinc-400">|</span>
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              <span>{events.length}件</span>
            </button>

            {/* 手持ち服ドロワーボタン */}
            <button
              onClick={() => setIsClosetDrawerOpen(true)}
              className="flex items-center gap-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-800 transition"
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
          onOpenContextDrawer={() => setIsContextDrawerOpen(true)}
          onOpenClosetDrawer={() => setIsClosetDrawerOpen(true)}
          selectedOutfitRank={selectedOutfitRank}
          isCalendarSaving={isCalendarSaving}
          isLoading={isLoading}
        />
        <div ref={chatBottomRef} />
      </main>

      {/* Bottom Sticky Composer */}
      <ChatComposer
        onSendMessage={handleUserSendMessage}
        onSendPhoto={handleSendPhoto}
        onSelectChip={handleSelectChip}
        suggestedChips={suggestedChips}
        disabled={isLoading}
      />

      {/* 手持ちクローゼットドロワー */}
      <ClosetDrawer
        isOpen={isClosetDrawerOpen}
        onClose={() => setIsClosetDrawerOpen(false)}
        wardrobe={wardrobe}
        onToggleLaundry={handleToggleLaundry}
        onItemDetail={(item) => setSelectedItemDetail(item)}
        onTriggerPhotoUpload={() => {
          setIsClosetDrawerOpen(false);
          handleSelectChip("📷 服を登録する");
        }}
        onSearchCrossModal={async (query) => {
          return searchWardrobeCrossModal({ query, wardrobe });
        }}
      />

      {/* 環境コンテキスト設定ドロワー */}
      <ContextDrawer
        isOpen={isContextDrawerOpen}
        onClose={() => setIsContextDrawerOpen(false)}
        weather={weather}
        events={events}
        profile={profile}
        gcalStatus={gcalStatus}
        isGCalLoading={isGCalLoading}
        onSelectCity={async (cityName) => {
          const newW = await lookupWeather(cityName);
          setWeather(newW);
          if (events) executeRecommendation(newW, events, profile, wardrobe, recentWornIds, `${cityName}の気象データに更新しました。`);
        }}
        onConnectGoogleCalendar={handleConnectGoogleCalendar}
        onDisconnectGoogleCalendar={handleDisconnectGoogleCalendar}
        onAddEvent={(ev) => {
          const updated = [...events, ev].sort((a, b) => a.start_time.localeCompare(b.start_time));
          setEvents(updated);
          if (weather) executeRecommendation(weather, updated, profile, wardrobe, recentWornIds, `予定「${ev.title}」を追加し、フォーマル度と活動量を再計算しました。`);
        }}
        onDeleteEvent={(idx) => {
          const updated = events.filter((_, i) => i !== idx);
          setEvents(updated);
          if (weather) executeRecommendation(weather, updated, profile, wardrobe, recentWornIds);
        }}
        onSensitivityChange={(delta) => {
          const nextProf = { ...profile, cold_sensitivity: delta };
          setProfile(nextProf);
          if (weather) executeRecommendation(weather, events, nextProf, wardrobe, recentWornIds);
        }}
      />

      {/* 衣服詳細モーダル */}
      {selectedItemDetail && (
        <div
          onClick={() => setSelectedItemDetail(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3"
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
                {selectedItemDetail.colors.join("・")} | スタイル: {selectedItemDetail.style_tags.join(", ") || "ベーシック"}
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

            <button
              onClick={() => setSelectedItemDetail(null)}
              className="w-full rounded-xl bg-zinc-900 py-2 text-xs font-bold text-white hover:bg-zinc-800"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
