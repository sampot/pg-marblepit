# pg-marblepit

**玻璃彈珠坑**：圓形彈珠台、拖曳發射、碰撞入洞計分、自製 Web Audio 音效。純前端，無建置步驟。

名稱與坑台佈局為原創小品，致敬彈珠檯／坑洞對戰玩法類型，非任一商業作品復刻。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。手感想再調？開進來玩，再叫 AI 幫你改一版。

## 一鍵開 SAM 小

**[一鍵開 SAM 小](https://play.samkuo.me/?open=sampot%2Fpg-marblepit&name=%E7%8E%BB%E7%92%83%E5%BD%88%E7%8F%A0%E5%9D%91&fresh=1)**

```
https://play.samkuo.me/?open=sampot/pg-marblepit&name=玻璃彈珠坑&fresh=1
```

同源會重用本機已匯入的沙盒；要強制新建可加 `&fresh=1`。

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

點一下頁面後音效才會出聲。

## 操作

| 操作 | 說明 |
| --- | --- |
| 拖曳後放開 | 在你的彈珠上反向拉弓瞄準（拉力＝力道）發射 |
| 開局 | 開始一局（你 1 顆 vs 對手 5 顆） |
| 音效開／關 | 靜音 |
| 再來一局 | 結束後重新開局 |

## 規則

- 圓形彈珠坑內有 5 個洞；彈珠**慢速**經過洞口重疊時會落入。
- 把**對手彈珠**撞入洞 → 你得分；**你的彈珠**入洞 → 對手得分。
- 先累積 **3 次**入坑者勝。
- 最佳紀錄存於 `localStorage` 鍵 `pg-marblepit-best`（你的最高入坑數）。

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 結構 |
| `styles.css` | 亮／暗色主題（mobile-first） |
| `app.js` | Canvas、輸入、HUD |
| `game.js` | 圓坑物理、回合、入洞判定 |
| `audio.js` | Web Audio 合成音效 |
| `functions.js` | Playgrounds 可選 stub |

## License

MIT
