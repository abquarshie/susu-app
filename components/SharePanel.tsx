"use client";
import { useState } from "react";
import { Icon } from "./icons";
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
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="card stack">
        <div>
          <div className="mb-2 text-[13px] font-semibold">Message</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Message">
            {groups.map((g) => (
              <button key={g} type="button" aria-pressed={group === g} onClick={() => { setGroup(g); setIdx(0); }}
                className="min-h-9 cursor-pointer rounded-full border border-line bg-surface px-3 py-1 text-[13px] font-medium transition-colors hover:bg-subtle aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand-ink">
                {g}
              </button>
            ))}
          </div>
        </div>
        {items.length > 1 && (
          <label className="field"><span>Receipt</span>
            <select className="input" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
              {items.map((m, i) => <option key={m.file} value={i}>{m.label}</option>)}
            </select>
          </label>
        )}
        <div className="grid gap-2">
          <button className="btn primary big" onClick={copy}><Icon name="copy" />Copy message</button>
          <div className="grid grid-cols-2 gap-2">
            {wa.length <= 1900
              ? <a className="btn" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="chat" />WhatsApp</a>
              : <span className="caption self-center">Too long for a direct link. Use Copy.</span>}
            <button className="btn" onClick={download}><Icon name="download" />.txt</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section">
          <h2 className="section-title">Preview</h2>
          <span className="section-aside">{msg.text.length.toLocaleString("en-US")} characters</span>
        </div>
        <div className="rounded-2xl bg-subtle p-3 md:p-4">
          <pre className="bubble">{msg.text}</pre>
        </div>
      </section>
    </div>
  );
}
