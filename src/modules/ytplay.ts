import { Client, Message, VoiceChannel } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, VoiceConnection, AudioPlayerStatus } from '@discordjs/voice'
import Module from '../utils/module'
import { boundClass } from 'autobind-decorator'
import ytdl from 'ytdl-core'


class Player {
  constructor(msg: Message) {
    if (!(msg.channel instanceof VoiceChannel)) throw new Error('Not in a voice channel')

    this.channel = getVoiceConnection(msg.channel.guild.id) || joinVoiceChannel({
      channelId: msg.channel.id,
      guildId: msg.guildId as string,
      adapterCreator: msg.guild?.voiceAdapterCreator as any,
    })
    this.channel.subscribe(this.player)
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.playNext()
    })
  }
  private channel: VoiceConnection | null = null
  private player = createAudioPlayer()
  readonly queue: string[] = []
  private current: string | null = null

  addQueue(id: string) {
    this.queue.push(id)
    this.playNext()
  }
  playNext() {
    if (this.player.state.status !== AudioPlayerStatus.Idle) return
    const id = this.queue.shift()
    if (!id) {
      this.current = null
      this.player.stop()
      return
    }
    this.current = id

    const audio = ytdl(id, { filter: 'audioonly', quality: 'highestaudio' })
    const resource = createAudioResource(audio)
    this.player.play(resource)
  }
  skip() {
    this.player.stop()
    this.playNext()
  }
  destroy() {
    this.channel?.destroy()
  }
  getQueue() {
    return { current: this.current, queue: this.queue }
  }

}


@boundClass
export default class YoutubePlay extends Module {
  constructor(client: Client) {
    super(client)
  }

  name = 'Youtube DL'
  instances: { [key: string]: Player | null} = {}
  
  getInstance(id: string) {
    return this.instances[id]
  }

  install() {
    //pass
  }

  async mentionHook(msg: Message) {
    const instance = this.getInstance(msg.channel.id)
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
      
      await msg.channel.send(`Queing ${id}...`)

      if (instance) {
        instance.addQueue(id)
      } else {
        this.instances[msg.channel.id] = new Player(msg)
        const newInstance = this.getInstance(msg.channel.id)
        if (!newInstance) throw new Error('Failed to create new instance')
        newInstance.addQueue(id)
      }
      return true
    }
    if (instance) {
      if (msg.content.toLowerCase().startsWith('!leave') && msg.channel instanceof VoiceChannel ) {
        instance.destroy()
        this.instances[msg.channel.id] = null
        return true
      }
      if (msg.content.toLowerCase().startsWith('!skip') && msg.channel instanceof VoiceChannel ) {
        instance.skip()
        msg.channel.send(`Skipped: ${instance.getQueue().current}`)
        return true
      }
      if (msg.content.toLowerCase().startsWith('!queue') && msg.channel instanceof VoiceChannel ) {
        const { current, queue } = instance.getQueue()
        msg.channel.send(`Current: ${current}, Queue: ${queue.join(', ')}`)
        return true
      }
    }
    return false
  }
}
