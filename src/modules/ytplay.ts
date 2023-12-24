import { Client, Message, VoiceChannel } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection } from '@discordjs/voice'
import Module from '../utils/module'
import { boundClass } from 'autobind-decorator'
import ytdl from 'ytdl-core'

@boundClass
export default class YoutubePlay extends Module {
  constructor(client: Client) {
    super(client)
  }

  name = 'Youtube DL'
  queue: string[] = []

  install() {
    //pass
  }

  async mentionHook(msg: Message) {
    if (msg.content.toLowerCase().startsWith('!play') && msg.channel instanceof VoiceChannel) {
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
      
      await msg.channel.send(`Playing ${id}...`)
      
      // Get audio and video stream going
      const audio = ytdl(id, { quality: 'highestaudio' })

      const vc = getVoiceConnection(msg.channel.guild.id) || joinVoiceChannel({
        channelId: msg.channel.id,
        guildId: msg.guildId as string,
        adapterCreator: msg.guild?.voiceAdapterCreator as any,
      })
      const player = createAudioPlayer()
      vc.subscribe(player)
      
        
      const resource = createAudioResource(audio)
      player.play(resource)

      return true
    }
    if (msg.content.toLowerCase().startsWith('!leave') && msg.channel instanceof VoiceChannel ) {
      const vc = getVoiceConnection(msg.channel.guild.id)
      vc?.destroy()
    }
    return false
  }
}
