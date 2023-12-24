import { Client, Message } from 'discord.js'
import Module from '../utils/module'
import { boundClass } from 'autobind-decorator'
import ytdl from 'ytdl-core'
import fs from 'fs'


@boundClass
export default class YoutubeDL extends Module {
  constructor(client: Client) {
    super(client)
  }

  name = 'Youtube DL'
  videoPath = process.env.VIDEO_PATH ?? './video'

  install() {
    //pass
  }

  mentionHook(msg: Message) {
    if (msg.content.toLowerCase().startsWith('!ytdl')) {
      const arr = msg.content.split(' ')
      arr.shift()
      const url = arr.join(' ')
      const ytregex = /https:\/\/(www.)?(youtube\.com|youtu\.be)\/(watch\?v=)?(?<id>[1-9a-zA-Z_-]+)(\?&)?/g
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
      msg.channel.send(`Downloading ${id}...`)
        .then((stat) => {
          ytdl(id)
            .pipe(fs.createWriteStream(`${this.videoPath}/${id}.mp4`))
            .on('finish', () => {
              stat.edit(`Download ${id} Complete!`)
            })
        })
      return true
    } else {
      return false
    }
  }
}
