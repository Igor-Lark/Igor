"use client";

import { useState } from "react";

export function CopyButton({ text, href }: { text?: string; href?: string }) {
  const [message, setMessage] = useState("");
  return (
    <span className="row">
      <button
        type="button"
        className="secondary"
        onClick={async () => {
          const value = text ?? (href ? await (await fetch(href)).text() : "");
          await navigator.clipboard.writeText(value);
          setMessage("Скопировано");
        }}
      >
        Скопировать
      </button>
      {href ? (
        <a className="button secondary" href={href}>
          Скачать
        </a>
      ) : null}
      <span className="muted">{message}</span>
    </span>
  );
}
