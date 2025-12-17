const fs = require("fs");
const path = require("path");

let logDir = null;
let currentDate = null;
let logFilePath = null;

/**
 * Electron の userData 配下に日次ログを書き出す準備を行う。
 * アプリ起動時に一度だけ呼び出される想定で、ディレクトリが無い場合は作成する。
 *
 * @param {import("electron").App} app userData パスを提供する App インスタンス
 */
function initLogger(app) {
  try {
    const userData = app.getPath("userData");
    logDir = path.join(userData, "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (e) {
    console.error("[logger] initLogger failed:", e);
    logDir = null;
  }
}

/**
 * その日のログファイルパスを取得する。日付が変わったタイミングで
 * 自動的にファイル名を切り替える（例: mindra-2024-05-01.log）。
 *
 * @returns {string|null} 書き込み先ファイルパス。ログディレクトリが無ければ null。
 */
function getLogFilePath() {
  try {
    if (!logDir) return null;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (today !== currentDate || !logFilePath) {
      currentDate = today;
      logFilePath = path.join(logDir, `mindra-${today}.log`);
    }
    return logFilePath;
  } catch (e) {
    console.error("[logger] getLogFilePath failed:", e);
    return null;
  }
}

/**
 * ログを1行の JSON として追記する。`extra` にオブジェクトを渡すと
 * メタ情報を同じ行に含められる。
 *
 * @param {"INFO"|"WARN"|"ERROR"} level ログレベル
 * @param {string} message メッセージ本文
 * @param {Record<string, unknown>} [extra] 付加情報。非オブジェクトの場合は `extra` キーに格納。
 */
function write(level, message, extra) {
  try {
    const file = getLogFilePath();
    if (!file) return;
    const payload =
      extra && typeof extra === "object"
        ? { ts: new Date().toISOString(), level, message, ...extra }
        : { ts: new Date().toISOString(), level, message, extra };

    fs.appendFile(file, JSON.stringify(payload) + "\n", (err) => {
      if (err) {
        console.error("[logger] appendFile error:", err);
      }
    });
  } catch (e) {
    console.error("[logger] write failed:", e);
  }
}

module.exports = {
  initLogger,
  logInfo(message, extra) {
    write("INFO", message, extra);
  },
  logWarn(message, extra) {
    write("WARN", message, extra);
  },
  logError(message, extra) {
    write("ERROR", message, extra);
  },
  getLogsDir() {
    return logDir;
  },
};

// =======================================
// 古いログの自動削除（90日）
// =======================================
/**
 * 保存期間を過ぎたログファイルを削除するユーティリティ。
 * `maxDays` は日単位で指定し、デフォルトは 90 日。
 *
 * @param {string} logDir ログディレクトリの絶対パス
 * @param {number} [maxDays=90] 保持する日数
 */
function removeOldLogs(logDir, maxDays = 90) {
  try {
    if (!fs.existsSync(logDir)) return;

    const files = fs.readdirSync(logDir);
    const now = Date.now();
    const limit = maxDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const full = path.join(logDir, file);
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;

      const age = now - stat.mtimeMs;
      if (age > limit) {
        fs.unlinkSync(full);
      }
    }
  } catch (e) {
    console.error("[logger] failed to delete old logs:", e);
  }
}

module.exports.removeOldLogs = removeOldLogs;
