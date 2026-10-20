"use client";
import { useState } from "react";
import { useToast } from "./Toaster";

export type Message = { group: string; label: string; text: string; file: string };

export function SharePanel({ messages }: { messages: Message[] }) {
  const groups = [...new Set(messages.map((m) => m.group))];
  const [group, setGroup] = useState(groups[0]);
  const items = messages.filter((m) => m.group === group);
  const [idx, setIdx] = useState(0);
  const msg = items[Math.min(idx, items.length - 1)];
  const toast = useToast();
  const wa = `https://wa.me/?text=${encodeURIComponent(msg.text)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      toast("Copied. Paste it into WhatsApp.");
    } catch {
      toast("Couldn't copy automatically. Select the text and copy it.", "warning");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([msg.text], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: msg.file });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card stack">
      <div className="grid2">
        <label className="f">Message
          <select value={group} onChange={(e) => { setGroup(e.target.value); setIdx(0); }}>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        {items.length > 1 && (
          <label className="f">Receipt
            <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
              {items.map((m, i) => <option key={m.file} value={i}>{m.label}</option>)}
            </select>
          </label>
        )}
      </div>
      <pre className="msg">{msg.text}</pre>
      <div className="grid3">
        <button className="btn primary" onClick={copy}>Copy</button>
        {wa.length <= 1900
          ? <a className="btn" href={wa} target="_blank" rel="noopener noreferrer">Open in WhatsApp</a>
          : <span className="caption" style={{ alignSelf: "center" }}>Too long for a direct link. Use Copy.</span>}
        <button className="btn" onClick={download}>Download .txt</button>
      </div>
    </section>
  );
}
