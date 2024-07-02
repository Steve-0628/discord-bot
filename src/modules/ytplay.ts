import { Client, Message, VoiceChannel } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, VoiceConnection, AudioPlayerStatus } from '@discordjs/voice'
import Module from '../utils/module'
import { boundClass } from 'autobind-decorator'
import play from 'play-dl'


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
  private loop = false

  async addQueue(id: string) {
    this.queue.push(id)
    await this.playNext()
  }
  async playNext() {
    if (this.player.state.status !== AudioPlayerStatus.Idle) return
    if (!this.loop) {
      const id = this.queue.shift()
      if (!id) {
        this.current = null
        this.player.stop()
        return
      }
      this.current = id
    }

    // const audio = ytdl(id, { filter: 'audioonly', quality: 'highestaudio' })
    const { stream } = await play.stream(this.current as string, {
      discordPlayerCompatibility: true,
    })
    const resource = createAudioResource(stream)
    this.player.play(resource)
  }
  skip() {
    this.loop = false
    this.player.stop()
    this.playNext()
  }
  destroy() {
    this.channel?.destroy()
  }
  getQueue() {
    return { current: this.current, queue: this.queue, loop: this.loop }
  }
  toggleLoop() {
    this.loop = !this.loop
    return this.loop
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
      const ytregex = /https:\/\/(www.|music.|m.)?(youtube\.com|youtu\.be)\/(watch\?v=)?(?<id>[0-9a-zA-Z_-]+)(\?&)?/g
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
        const { current, loop } = instance.getQueue()
        msg.channel.send(`Skipped: ${current}, ${loop ? 'Loop turned off' : ''}`)
        instance.skip()
        return true
      }
      if (msg.content.toLowerCase().startsWith('!queue') && msg.channel instanceof VoiceChannel ) {
        const { current, queue, loop } = instance.getQueue()
        msg.channel.send(`Current: ${current}, Queue: ${queue.join(', ')}, Loop: ${loop}`)
        return true
      }
      if (msg.content.toLowerCase().startsWith('!loop') && msg.channel instanceof VoiceChannel ) {
        const current = instance.toggleLoop()
        msg.channel.send(`Toggled loop: ${current}`)
        return true
      }
    }
    return false
  }
}
