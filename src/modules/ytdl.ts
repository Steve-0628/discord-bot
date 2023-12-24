import { Client, Message } from 'discord.js'
import Module from '../utils/module'
import { boundClass } from 'autobind-decorator'
import ytdl from 'ytdl-core'
import fs from 'fs'
import cp from 'child_process'
import ffmpeg from 'ffmpeg-static'

@boundClass
export default class YoutubeDL extends Module {
  constructor(client: Client) {
    super(client)
    if (!ffmpeg) {
      throw new Error('ffmpeg not found')
    }
    this.ffmpeg = ffmpeg
  }

  name = 'Youtube DL'
  videoPath = process.env.VIDEO_PATH ?? './video'
  ffmpeg: string

  install() {
    //pass
  }

  async mentionHook(msg: Message) {
    if (msg.content.toLowerCase().startsWith('!ytdl')) {
      const arr = msg.content.split(' ')
      arr.shift()
      const url = arr.join(' ')
      const ytregex = /https:\/\/(www.)?(youtube\.com|youtu\.be)\/(watch\?v=)?(?<id>[0-9a-zA-Z_-]+)(\?&)?/g
      const match = ytregex.exec(url)
      if (!match) {
        msg.channel.send('Invalid URL')
        return true
      }
      const id = match.groups?.id
      if (!id) {
        msg.channel.send('Invalid URL')
        return true
      }
      const stat = await msg.channel.send(`Downloading ${id}...`)
      const tracker = {
        start: Date.now(),
        audio: { downloaded: 0, total: Infinity },
        video: { downloaded: 0, total: Infinity },
      }
      
      // Get audio and video stream going
      const audio = ytdl(id, { quality: 'highestaudio' })
        .on('progress', (_, downloaded, total) => {
          tracker.audio = { downloaded, total }
        })
      const video = ytdl(id, { quality: 'highestvideo' })
        .on('progress', (_, downloaded, total) => {
          tracker.video = { downloaded, total }
        })
      
      // Get the progress bar going
      const progressbar = setInterval(() => {

        const toMB = (i: number) => (i / 1024 / 1024).toFixed(2)

        const message = `Audio | \`${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}%\` processed (\`${toMB(tracker.audio.downloaded)}MB\` of \`${toMB(tracker.audio.total)}MB\`)
Video | \`${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}%\` processed (\`${toMB(tracker.video.downloaded)}MB\` of \`${toMB(tracker.video.total)}MB\`)
running for: \`${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)}\` Minutes`
        stat.edit(message)

      }, 1000)
      
      // Start the ffmpeg child process
      const ffmpegProcess: cp.ChildProcess & { stdio: any[] } = cp.spawn(this.ffmpeg, [
        // Remove ffmpeg's console spamming
        '-loglevel', '0', '-hide_banner',
        // 3 second audio offset
        // '-itsoffset', '3.0', 
        // inputs
        '-i', 'pipe:3',
        '-i', 'pipe:4',
        // map audio and video
        '-map', '0:a',
        '-map', '1:v',
        // Choose some fancy codes
        '-c:v', 'copy',
        '-c:a', 'copy',
        // Define output container
        '-f', 'matroska', 'pipe:5',
      ], {
        windowsHide: true,
        stdio: [
          /* Standard: stdin, stdout, stderr */
          'inherit', 'inherit', 'inherit',
          /* Custom: pipe:3, pipe:4, pipe:5 */
          'pipe', 'pipe', 'pipe',
        ],
      })
      ffmpegProcess.on('close', (e) => {
        setTimeout(() => {
          clearInterval(progressbar)
        }, 1200)
        if (e !== 0) {
          msg.channel.send(`Failed to process ${id}`)
        }
      })
      
      // Link streams
      // FFmpeg creates the transformer streams and we just have to insert / read data
      audio.pipe(ffmpegProcess.stdio[3] as any)
        .on('error', console.error)
      video.pipe(ffmpegProcess.stdio[4] as any)
        .on('error', console.error)
      ffmpegProcess.stdio[5].pipe(fs.createWriteStream(`${this.videoPath}/${id}.mp4`))
        .on('error', console.error)

      return true
    } else {
      return false
    }
  }
}
