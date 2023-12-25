import Command from '../utils/command-gen'
import { Message } from 'discord.js'

const reactionList: [string[] | RegExp, string][] = [
  [
    ['ping'],
    'pong'
  ],
  [
    ['help'],
    '!github !cloudflare !ping !help !ytdl !play !leave !skip !queue'
  ],
]

const reactions = reactionList.map(reaction => {
  return new Command(reaction[0], async (message: Message) => {
    await message.channel.send(reaction[1])
  })
})

export default reactions
