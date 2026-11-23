"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import RobotCanvas, { type RobotApi } from "./RobotCanvas";
import TrendyChat, { type ChatState } from "./TrendyChat";

/**
 * TREND AI as a small floating companion on the store's inner pages.
 * The homepage has the full robot inside its hero card instead.
 */
const HIDE_ON = [/^\/$/, /^\/admin/, /^\/diagnose/, /^\/login/, /^\/register/, /^\/moamalat-pay/, /^\/r\//, /^\/studio/, /^\/tiktok/, /^\/facebook/, /^\/ads/, /^\/bot/, /^\/subscriptions/];

export default function HoloBot() {
  const pathname = usePathname() || "/";
  const bot = useRef<RobotApi>(null);
  const [chat, setChat] = useState(false);
  if (HIDE_ON.some((r) => r.test(pathname))) return null;

  const onState = (s: ChatState) => {
    if (s === "thinking") bot.current?.setMood("thinking");
    else if (s === "speaking") { bot.current?.setMood("happy"); bot.current?.talk(true); }
    else { bot.current?.talk(false); bot.current?.setMood("listening"); }
  };

  return (
    <>
      <div className="holo holo-mini">
        <button className="holo-stage" aria-label="TREND AI — اسأل ترندي"
          onClick={() => { setChat((c) => !c); bot.current?.wave(); bot.current?.setMood("listening"); }}>
          <RobotCanvas ref={bot} className="holo-canvas" />
        </button>
      </div>
      <TrendyChat open={chat} onClose={() => { setChat(false); bot.current?.setMood("neutral"); }} onState={onState} />
    </>
  );
}
