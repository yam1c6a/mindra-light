// 自然文コマンド → 構造化コマンド（NLU層）

(function () {
  /**
   * 空白除去と小文字化で検索用に標準化する。
   * @param {string} text 変換対象テキスト。
   * @returns {string} 正規化した文字列。
   */
  function normalize(text) {
    return (text || "").replace(/\s+/g, "").toLowerCase();
  }

  /**
   * 「検索して」などの末尾を除去して検索語を取り出す。
   * @param {string} text 元の入力テキスト。
   * @returns {string} 抽出した検索キーワード。
   */
  function extractSearchLike(text) {
    if (!text) return "";
    let q = text;
    q = q.replace(/(を)?(検索して?|検索)\s*$/gi, "");
    q = q.replace(/(を)?(調べて|調査して)\s*$/gi, "");
    return q.trim();
  }

  /**
   * 「〜って言って」系の定型句を外してメッセージ本体を得る。
   * @param {string} text 元の入力テキスト。
   * @returns {string} 送信メッセージ。
   */
  function extractSayLike(text) {
    if (!text) return "";
    let msg = text;
    msg = msg.replace(/(って送って|って送信して|って伝えて|って言って|と言って)\s*$/gi, "");
    return msg.trim();
  }

  /**
   * 自然文を解析し、要約・翻訳・Web検索などのコマンド種別を返す。
   * @param {string} raw 入力テキスト。
   * @returns {{type: string, raw: string, text?: string, targetLang?: string}}
   */
  function parse(raw) {
    const trimmed = (raw || "").toString().trim();
    if (!trimmed) return { type: "chat", raw: "" };
    const n = normalize(trimmed);

    // -------------------------
    // プレフィックスコマンド
    // -------------------------

    // search:xxxxx → Web検索系
    if (/^search:/i.test(trimmed)) {
      const q = trimmed.replace(/^search:/i, "").trim();
      return { type: "web", raw, text: q };
    }

    // say:xxxxx → Web送信系
    if (/^say:/i.test(trimmed)) {
      const msg = trimmed.replace(/^say:/i, "").trim();
      return { type: "web", raw, text: msg };
    }

    // ★ X:xxxxx → X 自動操作系
    if (/^x:/i.test(trimmed)) {
      const body = trimmed.replace(/^x:/i, "").trim();
      return { type: "x", raw, text: body };
    }

    // -------------------------
    // 日本語自然文コマンド
    // -------------------------

    // 要約系
    if (
      n === "要約" ||
      n === "要約して" ||
      n.endsWith("を要約して") ||
      n.endsWith("要約") ||
      n.includes("ページ要約") ||
      n.includes("本文要約") ||
      n.includes("記事要約")
    ) {
      return { type: "summarize", raw };
    }

    // 翻訳系
    if (
      n.includes("翻訳して") ||
      n.endsWith("翻訳") ||
      n.includes("英訳して") ||
      n.includes("和訳して")
    ) {
      let targetLang = null;

      // ターゲット言語ざっくり判定
      if (
        n.includes("英語に翻訳") ||
        n.includes("英語へ翻訳") ||
        n.includes("英訳して") ||
        n.includes("英訳")
      ) {
        targetLang = "en";
      } else if (
        n.includes("日本語に翻訳") ||
        n.includes("日本語へ翻訳") ||
        n.includes("和訳して") ||
        n.includes("和訳")
      ) {
        targetLang = "ja";
      }

      return {
        type: "translate",
        raw,
        targetLang, // null の場合は dispatcher 側でデフォルト
      };
    }

    // 「〜って送って」＝ Web送信
    if (
      n.endsWith("って送って") ||
      n.endsWith("って送信して") ||
      n.endsWith("って伝えて") ||
      n.endsWith("って言って") ||
      n.endsWith("と言って")
    ) {
      return {
        type: "web",
        raw,
        text: extractSayLike(raw),
      };
    }

    // 「〜を検索して」「〜を調べて」＝ Web検索
    if (
      n.includes("検索して") ||
      n.includes("を検索") ||
      /.+を検索$/.test(n) ||
      /.+検索して$/.test(n) ||
      n.includes("調べて") ||
      n.includes("調査して")
    ) {
      return {
        type: "web",
        raw,
        text: extractSearchLike(raw),
      };
    }

    // fallback: 普通のチャット
    return { type: "chat", raw };
  }

  window.mindraNaturalCommand = { parse };
})();
