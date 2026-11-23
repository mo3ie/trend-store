"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, ChevronLeft, Sparkles, Box } from "lucide-react";
import RobotCanvas, { type RobotApi } from "./RobotCanvas";
import TrendyChat, { type ChatState } from "./TrendyChat";

type Pick = { id: string; name: string; price: number; image_url: string | null; line: string; tag: string; has3d: boolean };

/**
 * The homepage's main stage: TREND AI stands in the big hero card, presents
 * real offers one by one (AI-written lines from /api/ai/picks), reacts with
 * its face, and opens the «ترندي» chat.
 */
export default function HeroRobot() {
  const bot = useRef<RobotApi>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [idx, setIdx] = useState(0);
  const [chat, setChat] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    fetch("/api/ai/picks").then((r) => r.json()).then((d) => setPicks(Array.isArray(d.picks) ? d.picks : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (chat || hover || picks.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % picks.length);
      bot.current?.setMood("excited");
      bot.current?.talk(true);
      setTimeout(() => { bot.current?.talk(false); bot.current?.setMood("happy"); }, 1500);
      setTimeout(() => bot.current?.setMood("neutral"), 3200);
    }, 6500);
    return () => clearInterval(t);
  }, [chat, hover, picks.length]);

  const onChatState = (s: ChatState) => {
    if (s === "thinking") { bot.current?.talk(false); bot.current?.setMood("thinking"); }
    else if (s === "speaking") { bot.current?.setMood("happy"); bot.current?.talk(true); }
    else { bot.current?.talk(false); bot.current?.setMood(chat ? "listening" : "neutral"); }
  };

  const openChat = () => {
    setChat(true);
    bot.current?.wave();
    bot.current?.setMood("listening");
  };

  const pick = picks[idx];

  return (
    <div className="g-hero g-hero-bot"
      onPointerEnter={() => { setHover(true); bot.current?.setMood("curious"); }}
      onPointerLeave={() => { setHover(false); if (!chat) bot.current?.setMood("neutral"); }}>
      <span className="hb-glow" aria-hidden />
      <button className="hb-stage" onClick={openChat} aria-label="TREND AI — اسأل ترندي">
        <RobotCanvas ref={bot} className="hb-canvas" />
      </button>
      <span className="hb-badge"><Sparkles size={12} /> TREND AI</span>
      {pick ? (
        <div className="hb-offer" key={pick.id}>
          <p>{pick.line}</p>
          <a href={`/products/${pick.id}`} className="hb-card">
            {pick.image_url && <img src={pick.image_url} alt="" />}
            <span><b>{pick.name}</b><em>{pick.price} د.ل</em></span>
            {pick.has3d ? <Box size={15} /> : <ChevronLeft size={16} />}
          </a>
          <button className="hb-ask" onClick={openChat}><MessageCircle size={14} /> اسأل ترندي</button>
        </div>
      ) : (
        <div className="hb-offer"><p>أهلاً 👋 أنا ترندي، مساعدك الذكي.</p><button className="hb-ask" onClick={openChat}><MessageCircle size={14} /> اسألني</button></div>
      )}
      <TrendyChat open={chat} onClose={() => { setChat(false); bot.current?.setMood("confirm"); setTimeout(() => bot.current?.setMood("neutral"), 1600); }} onState={onChatState} />
    </div>
  );
}
