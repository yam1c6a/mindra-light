// Mindra Light - ページ翻訳機能
// Webview の内容を取得 → 翻訳プロンプトを組み立ててローカルAIへ送信 → 結果を返す

/**
 * 表示中 WebView のテキストを取得して指定言語へ翻訳する。
 * @param {string} targetLang 翻訳後のターゲット言語（ja/en を想定）。
 * @returns {Promise<{ok: boolean, translation?: string, error?: string}>}
 */
async function translateActivePage(targetLang) {
  try {
    const wv = document.querySelector("webview[style*='visibility: visible']");
    if (!wv) throw new Error("Active WebView not found");

    // 要約と同じく、まず Wikipedia っぽい構造を優先しつつ、
    // なければ body 全体からテキストを取る
    const pageText = await wv.executeJavaScript(`
      (function () {
        const content = document.querySelector("#mw-content-text");
        if (content && content.innerText) {
          return content.innerText;
        }
        if (document.body && document.body.innerText) {
          return document.body.innerText;
        }
        return "";
      })();
    `);

    if (!pageText || pageText.trim().length === 0) {
      return { ok: false, error: "ページのテキストが取得できませんでした" };
    }

    // targetLang の正規化（とりあえず ja / en だけ明示、それ以外はそのまま渡す）
    let lang = (targetLang || "").toLowerCase();
    if (lang !== "ja" && lang !== "en") {
      // よくある表記をざっくり吸収
      if (lang.startsWith("jp") || lang.startsWith("ja")) lang = "ja";
      else if (lang.startsWith("en")) lang = "en";
    }
    if (lang !== "ja" && lang !== "en") {
      // それでもよくわからなければ日本語にしておく
      lang = "ja";
    }

    const langLabel =
      lang === "en" ? "自然な英語" : "自然な日本語";

    // 翻訳用プロンプト
    const prompt = `
次の文章を ${langLabel} に翻訳してください。

▼ルール
・元の意味とニュアンスをできるだけ正確に保つ
・箇条書きや見出しは、できる範囲で構造を保つ
・「以下が翻訳です」などの前置きは書かない
・翻訳だけを書いてください

▼原文
${pageText}
`;

    if (!window.mindraAI || typeof window.mindraAI.chat !== "function") {
      return { ok: false, error: "AIバックエンドが利用できません" };
    }

    const res = await window.mindraAI.chat(prompt, { history: [] });

    if (typeof res === "string") {
      return { ok: true, translation: res };
    }

    if (res && res.ok && typeof res.text === "string") {
      return { ok: true, translation: res.text };
    }

    return {
      ok: false,
      error: res && res.error ? res.error : "翻訳に失敗しました",
    };
  } catch (e) {
    console.error("[translator.js] translateActivePage error", e);
    return { ok: false, error: e.message };
  }
}

// 他ファイルから使えるよう export
window.mindraTranslator = {
  translateActivePage,
};
