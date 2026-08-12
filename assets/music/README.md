# 音乐文件说明

当前目录里已经放了一个 `sample.wav`，首页音乐按钮可以直接播放。把自己的歌曲文件放到这个目录，例如：

- `assets/music/song-1.mp3`
- `assets/music/song-2.mp3`

然后打开 `js/data.js`，把 `music` 里的 `src` 改成对应路径：

```js
music: [
  {
    title: "歌曲标题",
    artist: "歌手或歌单名",
    src: "./assets/music/song-1.mp3"
  }
]
```

首页音乐组件会读取这个路径并播放。
