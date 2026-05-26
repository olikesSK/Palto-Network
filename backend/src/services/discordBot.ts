import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ActivityType,
  ChatInputCommandInteraction,
  ButtonInteraction,
  Message,
  GuildMember,
  PartialGuildMember,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  VoiceState,
  GuildBan,
  TextChannel,
  OverwriteType,
  Guild,
} from 'discord.js';
import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

interface BotConfig {
  id: string; bot_token: string; guild_id: string; prefix: string;
  activity_type: string; activity_text: string; status: string; enabled: number;
}

interface TicketConfig {
  id: string; enabled: number; category_id: string; log_channel_id: string;
  support_role_id: string; max_per_user: number; welcome_message: string;
  panel_title: string; panel_description: string; panel_color: string;
}

interface WelcomeConfig {
  id: string; enabled: number; channel_id: string; message: string;
  embed_enabled: number; embed_title: string; embed_color: string; embed_thumbnail: number;
  dm_enabled: number; dm_message: string;
  leave_enabled: number; leave_channel_id: string; leave_message: string;
}

interface Giveaway {
  id: string; channel_id: string; message_id: string; prize: string;
  winners_count: number; host_id: string; host_username: string;
  entries: string; winners: string; ends_at: string; ended: number; cancelled: number;
}

interface AutomodConfig {
  id: string; enabled: number; anti_spam: number; anti_links: number;
  anti_invites: number; bad_words: string; log_channel: string;
  spam_threshold: number; spam_interval: number;
}

function parseDuration(str: string): number | null {
  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let ms = 0; let match;
  while ((match = regex.exec(str)) !== null) {
    const v = parseInt(match[1]);
    const u = match[2].toLowerCase();
    if (u === 'd') ms += v * 86400000;
    else if (u === 'h') ms += v * 3600000;
    else if (u === 'm') ms += v * 60000;
    else if (u === 's') ms += v * 1000;
  }
  return ms > 0 ? ms : null;
}

function formatDuration(ms: number): string {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ') || '0s';
}

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level));
}

function replaceVars(text: string, member: GuildMember): string {
  return text
    .replace(/{user}/g, `<@${member.user.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, String(member.guild.memberCount))
    .replace(/{tag}/g, member.user.tag);
}

export class DiscordBotService {
  private client: Client | null = null;
  private isReady = false;
  private giveawayTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private xpCooldowns = new Map<string, number>();
  private spamTracker = new Map<string, number[]>();

  async start(): Promise<{ success: boolean; error?: string }> {
    try {
      const config = db.prepare('SELECT * FROM discord_bot_config WHERE id = ?').get('main') as BotConfig | undefined;
      if (!config?.bot_token || !config?.guild_id) {
        return { success: false, error: 'Bot token or Guild ID not configured' };
      }
      await this.stop();

      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.GuildVoiceStates,
          GatewayIntentBits.GuildModeration,
        ],
        partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
      });

      this.registerEvents(config);
      await this.client.login(config.bot_token);
      await this.registerSlashCommands(config.bot_token, config.guild_id);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.isReady = false;
    }
    this.giveawayTimers.forEach(t => clearTimeout(t));
    this.giveawayTimers.clear();
  }

  getStatus() {
    if (!this.client || !this.isReady) return { online: false, guilds: 0, users: 0, uptime: null };
    return { online: true, guilds: this.client.guilds.cache.size, users: this.client.users.cache.size, uptime: this.client.uptime };
  }

  async getGuildInfo(guildId: string) {
    if (!this.client || !this.isReady) return null;
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;
    try { await guild.members.fetch(); } catch {}
    const channels = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildCategory)
      .map(c => ({ id: c.id, name: (c as TextChannel).name, type: c.type }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { id: guild.id, name: guild.name, memberCount: guild.memberCount, channels, roles, iconURL: guild.iconURL() };
  }

  private registerEvents(config: BotConfig) {
    if (!this.client) return;

    this.client.once(Events.ClientReady, (c) => {
      this.isReady = true;
      console.log(`[Discord Bot] Logged in as ${c.user.tag}`);
      if (config.activity_text) {
        const types: Record<string, number> = { PLAYING: ActivityType.Playing, WATCHING: ActivityType.Watching, LISTENING: ActivityType.Listening, COMPETING: ActivityType.Competing };
        c.user.setPresence({ activities: [{ name: config.activity_text, type: (types[config.activity_type] ?? ActivityType.Playing) as ActivityType }], status: config.status as 'online' | 'idle' | 'dnd' | 'invisible' });
      }
      this.restoreGiveawayTimers();
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) await this.handleSlashCommand(interaction as ChatInputCommandInteraction);
      else if (interaction.isButton()) await this.handleButton(interaction as ButtonInteraction);
    });

    this.client.on(Events.MessageCreate, async (msg) => {
      if (msg.author.bot || !msg.guild) return;
      await this.handleMessage(msg as Message<true>);
    });

    this.client.on(Events.GuildMemberAdd, async (member) => { await this.handleMemberAdd(member as GuildMember); });
    this.client.on(Events.GuildMemberRemove, async (member) => { await this.handleMemberRemove(member as GuildMember | PartialGuildMember); });
    this.client.on(Events.MessageReactionAdd, async (reaction, user) => { if (!user.bot) await this.handleReactionAdd(reaction as MessageReaction | PartialMessageReaction, user as User | PartialUser); });
    this.client.on(Events.MessageReactionRemove, async (reaction, user) => { if (!user.bot) await this.handleReactionRemove(reaction as MessageReaction | PartialMessageReaction, user as User | PartialUser); });
    this.client.on(Events.MessageDelete, async (msg) => { await this.logMessageDelete(msg as Message); });
    this.client.on(Events.MessageUpdate, async (old, newMsg) => { await this.logMessageUpdate(old as Message, newMsg as Message); });
    this.client.on(Events.VoiceStateUpdate, async (old, nw) => { await this.logVoiceActivity(old, nw); });
    this.client.on(Events.GuildMemberUpdate, async (old, nw) => { await this.logRoleChange(old as GuildMember | PartialGuildMember, nw as GuildMember); });
    this.client.on(Events.GuildBanAdd, async (ban) => { await this.logBanEvent(ban, 'ban'); });
    this.client.on(Events.GuildBanRemove, async (ban) => { await this.logBanEvent(ban, 'unban'); });
  }

  // ─── Slash Commands Registration ───────────────────────────────────────────

  private async registerSlashCommands(token: string, guildId: string) {
    const commands = [
      new SlashCommandBuilder().setName('ticket-setup').setDescription('Vytvoríš ticket panel v kanáli')
        .addChannelOption(o => o.setName('channel').setDescription('Kanál pre panel').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder().setName('ticket-close').setDescription('Zatvoriť tento ticket')
        .addStringOption(o => o.setName('reason').setDescription('Dôvod zatvorenia').setRequired(false)),

      new SlashCommandBuilder().setName('warn').setDescription('Upozorniť člena')
        .addUserOption(o => o.setName('user').setDescription('Člen na upozornenie').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Dôvod').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('warns').setDescription('Zoznam varovaní používateľa')
        .addUserOption(o => o.setName('user').setDescription('Člen').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('delwarn').setDescription('Zmazať varovanie podľa ID')
        .addStringOption(o => o.setName('id').setDescription('ID varovania').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('ban').setDescription('Zabanvať člena')
        .addUserOption(o => o.setName('user').setDescription('Člen na zaban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Dôvod').setRequired(false))
        .addIntegerOption(o => o.setName('delete_messages').setDescription('Dni správ na zmazanie (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

      new SlashCommandBuilder().setName('unban').setDescription('Odbanvať používateľa podľa ID')
        .addStringOption(o => o.setName('user_id').setDescription('ID používateľa').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Dôvod').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

      new SlashCommandBuilder().setName('kick').setDescription('Vykopnúť člena')
        .addUserOption(o => o.setName('user').setDescription('Člen na vykopnutie').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Dôvod').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

      new SlashCommandBuilder().setName('mute').setDescription('Stlmiť člena')
        .addUserOption(o => o.setName('user').setDescription('Člen na stlmenie').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('Trvanie (napr. 1h30m)').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Dôvod').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('unmute').setDescription('Odtlmiť člena')
        .addUserOption(o => o.setName('user').setDescription('Člen').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('purge').setDescription('Zmazať správy')
        .addIntegerOption(o => o.setName('amount').setDescription('Počet správ (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
        .addUserOption(o => o.setName('user').setDescription('Zmazať iba správy tohto používateľa').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

      new SlashCommandBuilder().setName('giveaway').setDescription('Spravovať giveawaye')
        .addSubcommand(s => s.setName('start').setDescription('Spustiť giveaway')
          .addStringOption(o => o.setName('duration').setDescription('Trvanie (napr. 1h, 2d)').setRequired(true))
          .addIntegerOption(o => o.setName('winners').setDescription('Počet víťazov').setMinValue(1).setMaxValue(20).setRequired(true))
          .addStringOption(o => o.setName('prize').setDescription('Cena').setRequired(true))
          .addChannelOption(o => o.setName('channel').setDescription('Kanál (predvolený: aktuálny)').setRequired(false)))
        .addSubcommand(s => s.setName('end').setDescription('Ukončiť giveaway').addStringOption(o => o.setName('id').setDescription('ID správy').setRequired(true)))
        .addSubcommand(s => s.setName('reroll').setDescription('Znovu losovať giveaway').addStringOption(o => o.setName('id').setDescription('ID správy').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('Zoznam aktívnych giveawayov'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder().setName('level').setDescription('Zobraziť tvoju XP úroveň')
        .addUserOption(o => o.setName('user').setDescription('Používateľ').setRequired(false)),

      new SlashCommandBuilder().setName('leaderboard').setDescription('XP rebríček'),

      new SlashCommandBuilder().setName('say').setDescription('Napísať niečo cez bota')
        .addStringOption(o => o.setName('message').setDescription('Text správy').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Kanál (predvolený: aktuálny)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

      new SlashCommandBuilder().setName('embed').setDescription('Odoslať embed správu')
        .addStringOption(o => o.setName('title').setDescription('Nadpis').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Popis').setRequired(true))
        .addStringOption(o => o.setName('color').setDescription('Farba (hex)').setRequired(false))
        .addChannelOption(o => o.setName('channel').setDescription('Kanál').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

      new SlashCommandBuilder().setName('role').setDescription('Pridať/odobrať rolu členovi')
        .addSubcommand(s => s.setName('add').setDescription('Pridať rolu')
          .addUserOption(o => o.setName('user').setDescription('Člen').setRequired(true))
          .addRoleOption(o => o.setName('role').setDescription('Rola na pridanie/odobranie').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Odobrať rolu')
          .addUserOption(o => o.setName('user').setDescription('Člen').setRequired(true))
          .addRoleOption(o => o.setName('role').setDescription('Rola na pridanie/odobranie').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

      new SlashCommandBuilder().setName('userinfo').setDescription('Zobraziť informácie o používateľovi')
        .addUserOption(o => o.setName('user').setDescription('Používateľ').setRequired(false)),

      new SlashCommandBuilder().setName('serverinfo').setDescription('Zobraziť informácie o serveri'),

      new SlashCommandBuilder().setName('avatar').setDescription('Zobraziť avatar')
        .addUserOption(o => o.setName('user').setDescription('Používateľ').setRequired(false)),

      new SlashCommandBuilder().setName('slowmode').setDescription('Nastaviť pomalý režim')
        .addIntegerOption(o => o.setName('seconds').setDescription('Sekundy (0 vypnúť)').setMinValue(0).setMaxValue(21600).setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Kanál').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

      new SlashCommandBuilder().setName('lock').setDescription('Zamknúť kanál')
        .addChannelOption(o => o.setName('channel').setDescription('Kanál').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

      new SlashCommandBuilder().setName('unlock').setDescription('Odomknúť kanál')
        .addChannelOption(o => o.setName('channel').setDescription('Kanál').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

      new SlashCommandBuilder().setName('ping').setDescription('Pingnúť bota'),

      new SlashCommandBuilder().setName('poll').setDescription('Vytvoriť anketu')
        .addStringOption(o => o.setName('question').setDescription('Otázka ankety').setRequired(true))
        .addStringOption(o => o.setName('options').setDescription('Možnosti oddelené | (napr. Áno|Nie|Možno)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    ];

    const rest = new REST({ version: '10' }).setToken(token);
    try {
      await rest.put(Routes.applicationGuildCommands((this.client!.user?.id ?? ''), guildId), {
        body: commands.map(c => c.toJSON()),
      });
      console.log('[Discord Bot] Slash commands registered');
    } catch (err) {
      console.error('[Discord Bot] Failed to register slash commands:', err);
    }
  }

  // ─── Slash Command Handler ─────────────────────────────────────────────────

  private async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    const { commandName } = interaction;
    try {
      switch (commandName) {
        case 'ticket-setup': await this.cmdTicketSetup(interaction); break;
        case 'ticket-close': await this.cmdTicketClose(interaction); break;
        case 'warn': await this.cmdWarn(interaction); break;
        case 'warns': await this.cmdWarns(interaction); break;
        case 'delwarn': await this.cmdDelwarn(interaction); break;
        case 'ban': await this.cmdBan(interaction); break;
        case 'unban': await this.cmdUnban(interaction); break;
        case 'kick': await this.cmdKick(interaction); break;
        case 'mute': await this.cmdMute(interaction); break;
        case 'unmute': await this.cmdUnmute(interaction); break;
        case 'purge': await this.cmdPurge(interaction); break;
        case 'giveaway': await this.cmdGiveaway(interaction); break;
        case 'level': await this.cmdLevel(interaction); break;
        case 'leaderboard': await this.cmdLeaderboard(interaction); break;
        case 'say': await this.cmdSay(interaction); break;
        case 'embed': await this.cmdEmbed(interaction); break;
        case 'role': await this.cmdRole(interaction); break;
        case 'userinfo': await this.cmdUserinfo(interaction); break;
        case 'serverinfo': await this.cmdServerinfo(interaction); break;
        case 'avatar': await this.cmdAvatar(interaction); break;
        case 'slowmode': await this.cmdSlowmode(interaction); break;
        case 'lock': await this.cmdLock(interaction); break;
        case 'unlock': await this.cmdUnlock(interaction); break;
        case 'ping': await this.cmdPing(interaction); break;
        case 'poll': await this.cmdPoll(interaction); break;
      }
    } catch (err) {
      console.error(`[Discord Bot] Command error (${commandName}):`, err);
      const msg = { content: '❌ Nastala chyba.', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
  }

  // ─── Button Handler ────────────────────────────────────────────────────────

  private async handleButton(interaction: ButtonInteraction) {
    const { customId } = interaction;
    try {
      if (customId === 'create_ticket') await this.handleCreateTicket(interaction);
      else if (customId === 'close_ticket') await this.handleCloseTicket(interaction);
      else if (customId === 'confirm_close_ticket') await this.handleConfirmCloseTicket(interaction);
      else if (customId === 'cancel_close_ticket') { await interaction.update({ components: [] }); }
      else if (customId === 'giveaway_enter') await this.handleGiveawayEnter(interaction);
    } catch (err) {
      console.error('[Discord Bot] Button error:', err);
    }
  }

  // ─── Message Handler ───────────────────────────────────────────────────────

  private async handleMessage(msg: Message<true>) {
    await this.handleStickyMessage(msg);
    await this.handleXP(msg);
    await this.handleCustomCommands(msg);
    await this.handleAutomod(msg);
  }

  // ─── TICKET SYSTEM ─────────────────────────────────────────────────────────

  private async cmdTicketSetup(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel', true) as TextChannel;
    const config = db.prepare('SELECT * FROM discord_ticket_config WHERE id = ?').get('main') as TicketConfig;

    const embed = new EmbedBuilder()
      .setTitle(config.panel_title)
      .setDescription(config.panel_description)
      .setColor(parseInt(config.panel_color.replace('#', ''), 16))
      .setFooter({ text: interaction.guild!.name, iconURL: interaction.guild!.iconURL() ?? undefined });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Otvoriť ticket').setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket panel vytvorený v ${channel}`, ephemeral: true });
  }

  private async handleCreateTicket(interaction: ButtonInteraction) {
    const config = db.prepare('SELECT * FROM discord_ticket_config WHERE id = ?').get('main') as TicketConfig;
    if (!config.enabled) { await interaction.reply({ content: '❌ Systém ticketov je vypnutý.', ephemeral: true }); return; }

    const guild = interaction.guild!;
    const user = interaction.user;

    const existingTicket = db.prepare("SELECT * FROM discord_tickets WHERE user_id = ? AND status = 'open'").get(user.id);
    if (existingTicket) { await interaction.reply({ content: '❌ Už máš otvorený ticket!', ephemeral: true }); return; }

    await interaction.deferReply({ ephemeral: true });

    const ticketId = uuidv4();
    const ticketNum = (db.prepare('SELECT COUNT(*) as c FROM discord_tickets').get() as { c: number }).c + 1;
    const channelName = `ticket-${ticketNum.toString().padStart(4, '0')}`;

    const permOverwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ...(config.support_role_id ? [{ id: config.support_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
    ];

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.category_id || undefined,
      permissionOverwrites: permOverwrites,
    }) as TextChannel;

    db.prepare('INSERT INTO discord_tickets (id, channel_id, user_id, username) VALUES (?, ?, ?, ?)').run(ticketId, channel.id, user.id, user.username);

    const welcome = config.welcome_message.replace(/{user}/g, `<@${user.id}>`);
    const embed = new EmbedBuilder().setTitle('🎫 Ticket otvorený').setDescription(welcome).setColor(0x7c3aed).setFooter({ text: `Ticket ID: ${ticketId.slice(0, 8)}` }).setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Zatvoriť ticket').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: `<@${user.id}>${config.support_role_id ? ` <@&${config.support_role_id}>` : ''}`, embeds: [embed], components: [row] });
    await interaction.editReply({ content: `✅ Tvoj ticket bol vytvorený: ${channel}` });
  }

  private async cmdTicketClose(interaction: ChatInputCommandInteraction) {
    const ticket = db.prepare("SELECT * FROM discord_tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId) as { id: string; user_id: string } | undefined;
    if (!ticket) { await interaction.reply({ content: '❌ Toto nie je ticket kanál.', ephemeral: true }); return; }
    const reason = interaction.options.getString('reason') ?? 'Dôvod nebol uvedený';
    await this.closeTicket(interaction, ticket.id, reason);
  }

  private async handleCloseTicket(interaction: ButtonInteraction) {
    const ticket = db.prepare("SELECT * FROM discord_tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId) as { id: string } | undefined;
    if (!ticket) { await interaction.reply({ content: '❌ Ticket nebol nájdený.', ephemeral: true }); return; }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('confirm_close_ticket').setLabel('✅ Potvrdiť zatvorenie').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_close_ticket').setLabel('Zrušiť').setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: 'Naozaj chceš zatvoriť tento ticket?', components: [row], ephemeral: true });
  }

  private async handleConfirmCloseTicket(interaction: ButtonInteraction) {
    const ticket = db.prepare("SELECT * FROM discord_tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId) as { id: string } | undefined;
    if (!ticket) { await interaction.update({ content: '❌ Ticket nebol nájdený.', components: [] }); return; }
    await interaction.update({ content: 'Zatváranie ticketu...', components: [] });
    await this.closeTicket(interaction, ticket.id, 'Uzavrel používateľ');
  }

  private async closeTicket(interaction: ChatInputCommandInteraction | ButtonInteraction, ticketId: string, reason: string) {
    const guild = interaction.guild!;
    const channel = interaction.channel as TextChannel;

    db.prepare("UPDATE discord_tickets SET status = 'closed', closed_at = datetime('now'), closed_by_id = ?, closed_by_username = ? WHERE id = ?")
      .run(interaction.user.id, interaction.user.username, ticketId);

    const config = db.prepare('SELECT * FROM discord_ticket_config WHERE id = ?').get('main') as TicketConfig;

    // Send transcript to log channel
    if (config.log_channel_id) {
      const logChannel = guild.channels.cache.get(config.log_channel_id) as TextChannel | undefined;
      if (logChannel) {
        const embed = new EmbedBuilder().setTitle('🎫 Ticket zatvorený').addFields(
          { name: 'Kanál', value: channel.name, inline: true },
          { name: 'Uzavrel', value: interaction.user.tag, inline: true },
          { name: 'Dôvod', value: reason, inline: false },
        ).setColor(0xef4444).setTimestamp();
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    await channel.send({ embeds: [new EmbedBuilder().setDescription(`🔒 Ticket uzavrel ${interaction.user.tag}. Dôvod: ${reason}`).setColor(0xef4444)] });
    setTimeout(async () => { await channel.delete().catch(() => {}); }, 5000);
  }

  // ─── MODERATION ────────────────────────────────────────────────────────────

  private async cmdWarn(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember;
    const reason = interaction.options.getString('reason', true);
    const id = uuidv4();
    db.prepare('INSERT INTO discord_warns (id, user_id, username, moderator_id, moderator_username, reason) VALUES (?, ?, ?, ?, ?, ?)').run(id, target.user.id, target.user.username, interaction.user.id, interaction.user.username, reason);
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason) VALUES ('warn', ?, ?, ?, ?, ?)").run(target.user.id, target.user.username, interaction.user.id, interaction.user.username, reason);
    const warns = (db.prepare('SELECT COUNT(*) as c FROM discord_warns WHERE user_id = ?').get(target.user.id) as { c: number }).c;
    const embed = new EmbedBuilder().setTitle('⚠️ Člen upozornený').addFields(
      { name: 'Člen', value: `${target.user.tag}`, inline: true },
      { name: 'Moderátor', value: interaction.user.tag, inline: true },
      { name: 'Dôvod', value: reason, inline: false },
      { name: 'Celkovo varovaní', value: String(warns), inline: true },
      { name: 'ID varovania', value: id.slice(0, 8), inline: true },
    ).setColor(0xf59e0b).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    try { await target.send({ embeds: [new EmbedBuilder().setTitle(`⚠️ Bol si upozornený na serveri ${interaction.guild!.name}`).setDescription(`**Dôvod:** ${reason}`).setColor(0xf59e0b)] }); } catch {}
  }

  private async cmdWarns(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const warns = db.prepare('SELECT * FROM discord_warns WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(target.id) as { id: string; reason: string; moderator_username: string; created_at: string }[];
    const embed = new EmbedBuilder().setTitle(`⚠️ Varovania pre ${target.username}`).setColor(0xf59e0b);
    if (warns.length === 0) embed.setDescription('Žiadne varovania.');
    else embed.setDescription(warns.map((w, i) => `**${i + 1}.** \`${w.id.slice(0, 8)}\` - ${w.reason}\n*od ${w.moderator_username} • ${new Date(w.created_at).toLocaleDateString()}*`).join('\n\n'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async cmdDelwarn(interaction: ChatInputCommandInteraction) {
    const id = interaction.options.getString('id', true);
    const warn = db.prepare('SELECT * FROM discord_warns WHERE id LIKE ?').get(`${id}%`) as { id: string } | undefined;
    if (!warn) { await interaction.reply({ content: '❌ Varovanie nebolo nájdené.', ephemeral: true }); return; }
    db.prepare('DELETE FROM discord_warns WHERE id = ?').run(warn.id);
    await interaction.reply({ content: `✅ Varovanie \`${warn.id.slice(0, 8)}\` zmazané.`, ephemeral: true });
  }

  private async cmdBan(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember | null;
    const reason = interaction.options.getString('reason') ?? 'Dôvod nebol uvedený';
    const delDays = interaction.options.getInteger('delete_messages') ?? 0;
    if (!target) { await interaction.reply({ content: '❌ Člen nebol nájdený.', ephemeral: true }); return; }
    await target.ban({ reason, deleteMessageSeconds: delDays * 86400 });
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason) VALUES ('ban', ?, ?, ?, ?, ?)").run(target.user.id, target.user.username, interaction.user.id, interaction.user.username, reason);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔨 Člen zabanovaný').addFields({ name: 'Člen', value: target.user.tag, inline: true }, { name: 'Dôvod', value: reason }).setColor(0xef4444).setTimestamp()] });
  }

  private async cmdUnban(interaction: ChatInputCommandInteraction) {
    const userId = interaction.options.getString('user_id', true);
    const reason = interaction.options.getString('reason') ?? 'Dôvod nebol uvedený';
    await interaction.guild!.members.unban(userId, reason);
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason) VALUES ('unban', ?, 'Unknown', ?, ?, ?)").run(userId, interaction.user.id, interaction.user.username, reason);
    await interaction.reply({ content: `✅ Používateľ \`${userId}\` bol odbanovaný.` });
  }

  private async cmdKick(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember | null;
    const reason = interaction.options.getString('reason') ?? 'Dôvod nebol uvedený';
    if (!target) { await interaction.reply({ content: '❌ Člen nebol nájdený.', ephemeral: true }); return; }
    await target.kick(reason);
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason) VALUES ('kick', ?, ?, ?, ?, ?)").run(target.user.id, target.user.username, interaction.user.id, interaction.user.username, reason);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('👢 Člen vykopnutý').addFields({ name: 'Člen', value: target.user.tag }, { name: 'Dôvod', value: reason }).setColor(0xf97316).setTimestamp()] });
  }

  private async cmdMute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember | null;
    const durStr = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') ?? 'Dôvod nebol uvedený';
    const durMs = parseDuration(durStr);
    if (!target || !durMs) { await interaction.reply({ content: '❌ Neplatný člen alebo trvanie.', ephemeral: true }); return; }
    await target.timeout(durMs, reason);
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason, duration) VALUES ('mute', ?, ?, ?, ?, ?, ?)").run(target.user.id, target.user.username, interaction.user.id, interaction.user.username, reason, formatDuration(durMs));
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔇 Člen stlmený').addFields({ name: 'Člen', value: target.user.tag, inline: true }, { name: 'Trvanie', value: formatDuration(durMs), inline: true }, { name: 'Dôvod', value: reason }).setColor(0x6366f1).setTimestamp()] });
  }

  private async cmdUnmute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember | null;
    if (!target) { await interaction.reply({ content: '❌ Člen nebol nájdený.', ephemeral: true }); return; }
    await target.timeout(null);
    await interaction.reply({ content: `✅ ${target.user.tag} bol odtlmený.` });
  }

  private async cmdPurge(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');
    const channel = interaction.channel as TextChannel;
    let messages = await channel.messages.fetch({ limit: amount + 1 });
    if (user) messages = messages.filter(m => m.author.id === user.id);
    const deleted = await channel.bulkDelete(messages, true);
    await interaction.reply({ content: `✅ Zmazané ${deleted.size} správ.`, ephemeral: true });
  }

  // ─── GIVEAWAY SYSTEM ───────────────────────────────────────────────────────

  private async cmdGiveaway(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') await this.startGiveaway(interaction);
    else if (sub === 'end') await this.endGiveaway(interaction);
    else if (sub === 'reroll') await this.rerollGiveaway(interaction);
    else if (sub === 'list') await this.listGiveaways(interaction);
  }

  private async startGiveaway(interaction: ChatInputCommandInteraction) {
    const durStr = interaction.options.getString('duration', true);
    const winners = interaction.options.getInteger('winners', true);
    const prize = interaction.options.getString('prize', true);
    const targetChannel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    const durMs = parseDuration(durStr);
    if (!durMs) { await interaction.reply({ content: '❌ Neplatný formát trvania. Použi: 1h, 30m, 1d', ephemeral: true }); return; }

    const id = uuidv4();
    const endsAt = new Date(Date.now() + durMs).toISOString();

    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway!')
      .setDescription(`**Cena:** ${prize}\n**Víťazi:** ${winners}\n**Organizátor:** ${interaction.user}\n**Koniec:** <t:${Math.floor((Date.now() + durMs) / 1000)}:R>`)
      .setColor(0x7c3aed)
      .setFooter({ text: `ID: ${id.slice(0, 8)} • Stlač 🎉 pre vstup` })
      .setTimestamp(new Date(endsAt));

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 Zapojiť sa (0)').setStyle(ButtonStyle.Primary)
    );

    const msg = await targetChannel.send({ embeds: [embed], components: [row] });
    db.prepare('INSERT INTO discord_giveaways (id, channel_id, message_id, prize, winners_count, host_id, host_username, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, targetChannel.id, msg.id, prize, winners, interaction.user.id, interaction.user.username, endsAt);
    await interaction.reply({ content: `✅ Giveaway spustený v ${targetChannel}!`, ephemeral: true });

    const timer = setTimeout(() => this.endGiveawayById(id), durMs);
    this.giveawayTimers.set(id, timer);
  }

  private async handleGiveawayEnter(interaction: ButtonInteraction) {
    const giveaway = db.prepare("SELECT * FROM discord_giveaways WHERE message_id = ? AND ended = 0 AND cancelled = 0").get(interaction.message.id) as Giveaway | undefined;
    if (!giveaway) { await interaction.reply({ content: '❌ Tento giveaway sa skončil.', ephemeral: true }); return; }

    const entries: string[] = JSON.parse(giveaway.entries);
    if (entries.includes(interaction.user.id)) {
      const idx = entries.indexOf(interaction.user.id);
      entries.splice(idx, 1);
      db.prepare('UPDATE discord_giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), giveaway.id);
      await interaction.reply({ content: '✅ Odhlásil si sa z giveawaya.', ephemeral: true });
    } else {
      entries.push(interaction.user.id);
      db.prepare('UPDATE discord_giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), giveaway.id);
      await interaction.reply({ content: '🎉 Zapojil si sa do giveawaya!', ephemeral: true });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('giveaway_enter').setLabel(`🎉 Zapojiť sa (${entries.length})`).setStyle(ButtonStyle.Primary)
    );
    await interaction.message.edit({ components: [row] }).catch(() => {});
  }

  async endGiveawayById(id: string) {
    const giveaway = db.prepare('SELECT * FROM discord_giveaways WHERE id = ? AND ended = 0 AND cancelled = 0').get(id) as Giveaway | undefined;
    if (!giveaway || !this.client) return;

    const entries: string[] = JSON.parse(giveaway.entries);
    const winnerIds: string[] = [];
    const pool = [...entries];
    const count = Math.min(giveaway.winners_count, pool.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      winnerIds.push(pool.splice(idx, 1)[0]);
    }

    db.prepare('UPDATE discord_giveaways SET ended = 1, winners = ? WHERE id = ?').run(JSON.stringify(winnerIds), id);
    this.giveawayTimers.delete(id);

    const channel = this.client.channels.cache.get(giveaway.channel_id) as TextChannel | undefined;
    if (!channel) return;

    const winnerMentions = winnerIds.length > 0 ? winnerIds.map(w => `<@${w}>`).join(', ') : 'Žiadny víťaz (málo účastníkov)';
    const msg = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (msg) {
      const embed = new EmbedBuilder().setTitle('🎉 Giveaway skončil!').setDescription(`**Cena:** ${giveaway.prize}\n**Víťazi:** ${winnerMentions}\n**Organizátor:** <@${giveaway.host_id}>`).setColor(0x6b7280).setFooter({ text: `ID: ${id.slice(0, 8)}` }).setTimestamp();
      await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    }

    if (winnerIds.length > 0) await channel.send({ content: `🎉 Gratulujeme ${winnerMentions}! Vyhral si **${giveaway.prize}**!` });
    else await channel.send({ content: `😔 Žiadny víťaz pre **${giveaway.prize}** (žiadni účastníci).` });
  }

  private async endGiveaway(interaction: ChatInputCommandInteraction) {
    const id = interaction.options.getString('id', true);
    const giveaway = db.prepare('SELECT * FROM discord_giveaways WHERE id LIKE ? AND ended = 0').get(`${id}%`) as Giveaway | undefined;
    if (!giveaway) { await interaction.reply({ content: '❌ Žiadny aktívny giveaway nenájdený.', ephemeral: true }); return; }
    const timer = this.giveawayTimers.get(giveaway.id);
    if (timer) clearTimeout(timer);
    await this.endGiveawayById(giveaway.id);
    await interaction.reply({ content: '✅ Giveaway ukončený!', ephemeral: true });
  }

  private async rerollGiveaway(interaction: ChatInputCommandInteraction) {
    const id = interaction.options.getString('id', true);
    const giveaway = db.prepare('SELECT * FROM discord_giveaways WHERE id LIKE ? AND ended = 1').get(`${id}%`) as Giveaway | undefined;
    if (!giveaway) { await interaction.reply({ content: '❌ Ukončený giveaway nenájdený.', ephemeral: true }); return; }
    const entries: string[] = JSON.parse(giveaway.entries);
    if (!entries.length) { await interaction.reply({ content: '❌ Žiadni účastníci pre nové losovanie.', ephemeral: true }); return; }
    const winner = entries[Math.floor(Math.random() * entries.length)];
    const channel = interaction.channel as TextChannel;
    await channel.send({ content: `🎉 Nový víťaz: <@${winner}>! Gratulujeme k výhre **${giveaway.prize}**!` });
    await interaction.reply({ content: '✅ Znovu vylosované!', ephemeral: true });
  }

  private async listGiveaways(interaction: ChatInputCommandInteraction) {
    const giveaways = db.prepare('SELECT * FROM discord_giveaways WHERE ended = 0 AND cancelled = 0 ORDER BY ends_at ASC LIMIT 10').all() as Giveaway[];
    const embed = new EmbedBuilder().setTitle('🎉 Aktívne giveawaye').setColor(0x7c3aed);
    if (!giveaways.length) embed.setDescription('Žiadne aktívne giveawaye.');
    else embed.setDescription(giveaways.map(g => `**${g.prize}** - ${g.winners_count} víťaz(ov)\n\`${g.id.slice(0, 8)}\` • Koniec <t:${Math.floor(new Date(g.ends_at).getTime() / 1000)}:R>`).join('\n\n'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private restoreGiveawayTimers() {
    const active = db.prepare('SELECT * FROM discord_giveaways WHERE ended = 0 AND cancelled = 0').all() as Giveaway[];
    for (const g of active) {
      const remaining = new Date(g.ends_at).getTime() - Date.now();
      if (remaining <= 0) { this.endGiveawayById(g.id); }
      else {
        const timer = setTimeout(() => this.endGiveawayById(g.id), remaining);
        this.giveawayTimers.set(g.id, timer);
      }
    }
  }

  // ─── WELCOME / LEAVE ───────────────────────────────────────────────────────

  private async handleMemberAdd(member: GuildMember) {
    const config = db.prepare('SELECT * FROM discord_welcome_config WHERE id = ?').get('main') as WelcomeConfig;

    // Auto-roles
    const autoRoles = db.prepare("SELECT * FROM discord_auto_roles WHERE enabled = 1").all() as { role_id: string }[];
    for (const ar of autoRoles) {
      const role = member.guild.roles.cache.get(ar.role_id);
      if (role) await member.roles.add(role).catch(() => {});
    }

    if (!config.enabled || !config.channel_id) return;
    const channel = member.guild.channels.cache.get(config.channel_id) as TextChannel | undefined;
    if (!channel) return;

    if (config.embed_enabled) {
      const embed = new EmbedBuilder()
        .setTitle(replaceVars(config.embed_title, member))
        .setDescription(replaceVars(config.message, member))
        .setColor(parseInt(config.embed_color.replace('#', ''), 16))
        .setTimestamp();
      if (config.embed_thumbnail) embed.setThumbnail(member.user.displayAvatarURL());
      await channel.send({ embeds: [embed] }).catch(() => {});
    } else {
      await channel.send(replaceVars(config.message, member)).catch(() => {});
    }

    if (config.dm_enabled && config.dm_message) {
      await member.send(replaceVars(config.dm_message, member)).catch(() => {});
    }
  }

  private async handleMemberRemove(member: GuildMember | PartialGuildMember) {
    const config = db.prepare('SELECT * FROM discord_welcome_config WHERE id = ?').get('main') as WelcomeConfig;
    if (!config.leave_enabled || !config.leave_channel_id) return;
    const channel = member.guild.channels.cache.get(config.leave_channel_id) as TextChannel | undefined;
    if (!channel) return;
    const text = config.leave_message
      .replace(/{user}/g, `<@${member.user?.id}>`)
      .replace(/{username}/g, member.user?.username ?? 'Unknown')
      .replace(/{server}/g, member.guild.name)
      .replace(/{count}/g, String(member.guild.memberCount))
      .replace(/{tag}/g, member.user?.tag ?? 'Unknown');
    await channel.send(text).catch(() => {});
  }

  // ─── STICKY MESSAGES ───────────────────────────────────────────────────────

  private async handleStickyMessage(msg: Message<true>) {
    const sticky = db.prepare("SELECT * FROM discord_sticky_messages WHERE channel_id = ? AND enabled = 1").get(msg.channelId) as { id: string; content: string; last_message_id: string } | undefined;
    if (!sticky) return;
    const channel = msg.channel as TextChannel;
    if (sticky.last_message_id) await channel.messages.delete(sticky.last_message_id).catch(() => {});
    const newMsg = await channel.send({ embeds: [new EmbedBuilder().setDescription(sticky.content).setColor(0x7c3aed).setFooter({ text: '📌 Sticky Message' })] }).catch(() => null);
    if (newMsg) db.prepare('UPDATE discord_sticky_messages SET last_message_id = ? WHERE id = ?').run(newMsg.id, sticky.id);
  }

  // ─── XP / LEVEL SYSTEM ─────────────────────────────────────────────────────

  private async handleXP(msg: Message<true>) {
    const userId = msg.author.id;
    const now = Date.now();
    const lastXp = this.xpCooldowns.get(userId) ?? 0;
    if (now - lastXp < 60000) return; // 1 min cooldown
    this.xpCooldowns.set(userId, now);

    const xpGain = Math.floor(Math.random() * 10) + 15;
    let row = db.prepare('SELECT * FROM discord_levels WHERE user_id = ?').get(userId) as { id: string; xp: number; level: number; messages: number } | undefined;

    if (!row) {
      const id = uuidv4();
      db.prepare('INSERT INTO discord_levels (id, user_id, username, xp, level, messages) VALUES (?, ?, ?, ?, 0, 1)').run(id, userId, msg.author.username, xpGain);
      row = { id, xp: xpGain, level: 0, messages: 1 };
    } else {
      db.prepare('UPDATE discord_levels SET xp = xp + ?, messages = messages + 1, username = ?, last_xp_at = datetime(\'now\') WHERE user_id = ?').run(xpGain, msg.author.username, userId);
      row = { ...row, xp: row.xp + xpGain, messages: row.messages + 1 };
    }

    const xpNeeded = xpForLevel(row.level);
    if (row.xp >= xpNeeded) {
      const newLevel = row.level + 1;
      db.prepare('UPDATE discord_levels SET level = ?, xp = xp - ? WHERE user_id = ?').run(newLevel, xpNeeded, userId);

      // Level-up message
      const levelRoles = db.prepare('SELECT * FROM discord_level_roles WHERE level = ?').all(newLevel) as { role_id: string }[];
      for (const lr of levelRoles) {
        const role = msg.guild.roles.cache.get(lr.role_id);
        if (role) await msg.member?.roles.add(role).catch(() => {});
      }

      await msg.channel.send({ embeds: [new EmbedBuilder().setDescription(`🎉 Gratulujeme ${msg.author}! Dosiahol si **Úroveň ${newLevel}**!`).setColor(0x7c3aed)] }).catch(() => {});
    }
  }

  private async cmdLevel(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const row = db.prepare('SELECT * FROM discord_levels WHERE user_id = ?').get(target.id) as { xp: number; level: number; messages: number } | undefined;
    const xp = row?.xp ?? 0; const level = row?.level ?? 0; const messages = row?.messages ?? 0;
    const xpNeeded = xpForLevel(level);
    const bar = '█'.repeat(Math.floor((xp / xpNeeded) * 10)) + '░'.repeat(10 - Math.floor((xp / xpNeeded) * 10));
    const embed = new EmbedBuilder().setTitle(`📊 Úroveň hráča ${target.username}`).setThumbnail(target.displayAvatarURL()).addFields(
      { name: 'Úroveň', value: String(level), inline: true },
      { name: 'XP', value: `${xp}/${xpNeeded}`, inline: true },
      { name: 'Správy', value: String(messages), inline: true },
      { name: 'Postup', value: `\`${bar}\` ${Math.floor((xp / xpNeeded) * 100)}%`, inline: false },
    ).setColor(0x7c3aed);
    await interaction.reply({ embeds: [embed] });
  }

  private async cmdLeaderboard(interaction: ChatInputCommandInteraction) {
    const rows = db.prepare('SELECT * FROM discord_levels ORDER BY level DESC, xp DESC LIMIT 10').all() as { user_id: string; username: string; level: number; xp: number; messages: number }[];
    const embed = new EmbedBuilder().setTitle('🏆 XP Rebríček').setColor(0x7c3aed);
    const medals = ['🥇', '🥈', '🥉'];
    if (!rows.length) embed.setDescription('Zatiaľ žiadne dáta.');
    else embed.setDescription(rows.map((r, i) => `${medals[i] ?? `**${i + 1}.**`} <@${r.user_id}> — Level **${r.level}** • ${r.xp} XP`).join('\n'));
    await interaction.reply({ embeds: [embed] });
  }

  // ─── REACTION ROLES ────────────────────────────────────────────────────────

  private async handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch { return; }

    const emojiStr = reaction.emoji.id
      ? `${reaction.emoji.name}:${reaction.emoji.id}`
      : (reaction.emoji.name ?? '');

    const rr = db.prepare(
      'SELECT * FROM discord_reaction_roles WHERE message_id = ? AND (emoji = ? OR emoji = ? OR emoji = ?)'
    ).get(
      reaction.message.id, emojiStr, reaction.emoji.name ?? '', reaction.emoji.id ?? ''
    ) as { role_id: string } | undefined;

    if (!rr || !reaction.message.guild) return;
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    const role = reaction.message.guild.roles.cache.get(rr.role_id);
    if (member && role) await member.roles.add(role).catch(() => {});
  }

  private async handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch { return; }

    const emojiStr = reaction.emoji.id
      ? `${reaction.emoji.name}:${reaction.emoji.id}`
      : (reaction.emoji.name ?? '');

    const rr = db.prepare(
      'SELECT * FROM discord_reaction_roles WHERE message_id = ? AND (emoji = ? OR emoji = ? OR emoji = ?)'
    ).get(
      reaction.message.id, emojiStr, reaction.emoji.name ?? '', reaction.emoji.id ?? ''
    ) as { role_id: string } | undefined;

    if (!rr || !reaction.message.guild) return;
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    const role = reaction.message.guild.roles.cache.get(rr.role_id);
    if (member && role) await member.roles.remove(role).catch(() => {});
  }

  // ─── CUSTOM COMMANDS ───────────────────────────────────────────────────────

  private async handleCustomCommands(msg: Message<true>) {
    const config = db.prepare('SELECT * FROM discord_bot_config WHERE id = ?').get('main') as BotConfig;
    const prefix = config.prefix ?? '!';
    if (!msg.content.startsWith(prefix)) return;
    const trigger = msg.content.slice(prefix.length).split(' ')[0].toLowerCase();
    const cmd = db.prepare("SELECT * FROM discord_custom_commands WHERE trigger = ? AND enabled = 1").get(trigger) as { id: string; response: string; embed_enabled: number; embed_color: string } | undefined;
    if (!cmd) return;
    db.prepare('UPDATE discord_custom_commands SET uses = uses + 1 WHERE id = ?').run(cmd.id);
    if (cmd.embed_enabled) {
      await msg.channel.send({ embeds: [new EmbedBuilder().setDescription(cmd.response).setColor(parseInt(cmd.embed_color.replace('#', ''), 16))] });
    } else {
      await msg.channel.send(cmd.response);
    }
  }

  // ─── AUTOMOD ───────────────────────────────────────────────────────────────

  private async handleAutomod(msg: Message<true>) {
    const config = db.prepare('SELECT * FROM discord_automod_config WHERE id = ?').get('main') as AutomodConfig | undefined;
    if (!config?.enabled) return;
    const content = msg.content.toLowerCase();
    let violated = false; let reason = '';

    // Bad words
    const badWords: string[] = JSON.parse(config.bad_words || '[]');
    if (badWords.some(w => content.includes(w.toLowerCase()))) { violated = true; reason = 'Nevhodné slovo'; }

    // Anti-links
    if (!violated && config.anti_links && /https?:\/\//.test(msg.content)) {
      if (!msg.member?.permissions.has(PermissionFlagsBits.ManageMessages)) { violated = true; reason = 'Linky nie sú povolené'; }
    }

    // Anti-invites
    if (!violated && config.anti_invites && /discord\.gg\/\w+/i.test(msg.content)) { violated = true; reason = 'Discord pozvánky nie sú povolené'; }

    // Anti-spam
    if (!violated && config.anti_spam) {
      const key = `${msg.author.id}:${msg.channelId}`;
      const times = this.spamTracker.get(key) ?? [];
      const now = Date.now();
      const filtered = times.filter(t => now - t < config.spam_interval * 1000);
      filtered.push(now);
      this.spamTracker.set(key, filtered);
      if (filtered.length >= config.spam_threshold) { violated = true; reason = 'Zistený spam'; }
    }

    if (violated) {
      await msg.delete().catch(() => {});
      const warn = await msg.channel.send({ content: `⚠️ ${msg.author}, tvoja správa bola zmazaná: **${reason}**` }).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
      if (config.log_channel) {
        const logCh = msg.guild.channels.cache.get(config.log_channel) as TextChannel | undefined;
        if (logCh) await logCh.send({ embeds: [new EmbedBuilder().setTitle('🛡️ Automod').addFields({ name: 'Používateľ', value: msg.author.tag, inline: true }, { name: 'Dôvod', value: reason, inline: true }, { name: 'Kanál', value: `<#${msg.channelId}>`, inline: true }, { name: 'Obsah', value: msg.content.slice(0, 200) }).setColor(0xef4444).setTimestamp()] }).catch(() => {});
      }
    }
  }

  // ─── LOGGING ───────────────────────────────────────────────────────────────

  private async getLogChannel(key: keyof { message_delete_channel: string; message_edit_channel: string; member_join_channel: string; member_leave_channel: string; role_change_channel: string; voice_activity_channel: string; ban_channel: string }, guild: Guild): Promise<TextChannel | null> {
    const cfg = db.prepare('SELECT * FROM discord_logging_config WHERE id = ?').get('main') as Record<string, string | number> | undefined;
    if (!cfg?.enabled || !cfg[key]) return null;
    return guild.channels.cache.get(cfg[key] as string) as TextChannel ?? null;
  }

  private async logMessageDelete(msg: Message) {
    if (!msg.guild || msg.author?.bot) return;
    const ch = await this.getLogChannel('message_delete_channel', msg.guild);
    if (!ch) return;
    await ch.send({ embeds: [new EmbedBuilder().setTitle('🗑️ Správa zmazaná').addFields({ name: 'Autor', value: msg.author?.tag ?? 'Neznámy', inline: true }, { name: 'Kanál', value: `<#${msg.channelId}>`, inline: true }, { name: 'Obsah', value: msg.content?.slice(0, 1000) || '*žiadny obsah*' }).setColor(0xef4444).setTimestamp()] }).catch(() => {});
  }

  private async logMessageUpdate(oldMsg: Message, newMsg: Message) {
    if (!newMsg.guild || newMsg.author?.bot || oldMsg.content === newMsg.content) return;
    const ch = await this.getLogChannel('message_edit_channel', newMsg.guild);
    if (!ch) return;
    await ch.send({ embeds: [new EmbedBuilder().setTitle('✏️ Správa upravená').addFields({ name: 'Autor', value: newMsg.author?.tag ?? 'Neznámy', inline: true }, { name: 'Kanál', value: `<#${newMsg.channelId}>`, inline: true }, { name: 'Pred', value: oldMsg.content?.slice(0, 500) || '*prázdne*' }, { name: 'Po', value: newMsg.content?.slice(0, 500) || '*prázdne*' }).setColor(0xf59e0b).setTimestamp()] }).catch(() => {});
  }

  private async logVoiceActivity(oldState: VoiceState, newState: VoiceState) {
    if (!newState.guild || newState.member?.user.bot) return;
    const ch = await this.getLogChannel('voice_activity_channel', newState.guild);
    if (!ch) return;
    let description = '';
    if (!oldState.channelId && newState.channelId) description = `🔊 **${newState.member?.user.tag}** joined <#${newState.channelId}>`;
    else if (oldState.channelId && !newState.channelId) description = `🔇 **${oldState.member?.user.tag}** left <#${oldState.channelId}>`;
    else if (oldState.channelId !== newState.channelId) description = `🔀 **${newState.member?.user.tag}** moved from <#${oldState.channelId}> to <#${newState.channelId}>`;
    if (!description) return;
    await ch.send({ embeds: [new EmbedBuilder().setDescription(description).setColor(0x38bdf8).setTimestamp()] }).catch(() => {});
  }

  private async logRoleChange(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    const ch = await this.getLogChannel('role_change_channel', newMember.guild);
    if (!ch) return;
    const added = newMember.roles.cache.filter(r => !(oldMember as GuildMember).roles?.cache.has(r.id));
    const removed = (oldMember as GuildMember).roles?.cache.filter(r => !newMember.roles.cache.has(r.id));
    if (!added.size && !removed?.size) return;
    const embed = new EmbedBuilder().setTitle('👑 Roly aktualizované').addFields({ name: 'Člen', value: newMember.user.tag, inline: true });
    if (added.size) embed.addFields({ name: '+ Pridané', value: added.map(r => `<@&${r.id}>`).join(', '), inline: true });
    if (removed?.size) embed.addFields({ name: '- Odobrané', value: removed.map(r => `<@&${r.id}>`).join(', '), inline: true });
    await ch.send({ embeds: [embed.setColor(0xa78bfa).setTimestamp()] }).catch(() => {});
  }

  private async logBanEvent(ban: GuildBan, action: 'ban' | 'unban') {
    const ch = await this.getLogChannel('ban_channel', ban.guild);
    if (!ch) return;
    const embed = new EmbedBuilder().setTitle(action === 'ban' ? '🔨 Člen zabanovaný' : '✅ Člen odbanovaný').addFields({ name: 'Používateľ', value: ban.user.tag, inline: true }, { name: 'ID používateľa', value: ban.user.id, inline: true }).setColor(action === 'ban' ? 0xef4444 : 0x22c55e).setTimestamp();
    if (ban.reason) embed.addFields({ name: 'Dôvod', value: ban.reason });
    await ch.send({ embeds: [embed] }).catch(() => {});
  }

  // ─── UTILITY COMMANDS ──────────────────────────────────────────────────────

  private async cmdSay(interaction: ChatInputCommandInteraction) {
    const message = interaction.options.getString('message', true);
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.send(message);
    await interaction.reply({ content: '✅ Správa odoslaná.', ephemeral: true });
  }

  private async cmdEmbed(interaction: ChatInputCommandInteraction) {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const color = interaction.options.getString('color') ?? '#7c3aed';
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(parseInt(color.replace('#', ''), 16)).setTimestamp()] });
    await interaction.reply({ content: '✅ Embed odoslaný.', ephemeral: true });
  }

  private async cmdRole(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getMember('user') as GuildMember;
    const role = interaction.options.getRole('role')!;
    if (sub === 'add') { await target.roles.add(role.id); await interaction.reply({ content: `✅ Rola ${role} pridaná používateľovi ${target.user.tag}.` }); }
    else { await target.roles.remove(role.id); await interaction.reply({ content: `✅ Rola ${role} odobraná používateľovi ${target.user.tag}.` }); }
  }

  private async cmdUserinfo(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember ?? interaction.member as GuildMember;
    const user = target.user;
    const embed = new EmbedBuilder().setTitle(`👤 ${user.username}`).setThumbnail(user.displayAvatarURL()).addFields(
      { name: 'ID', value: user.id, inline: true },
      { name: 'Tag', value: user.tag, inline: true },
      { name: 'Prezývka', value: target.nickname ?? '*žiadna*', inline: true },
      { name: 'Pripojil sa', value: `<t:${Math.floor((target.joinedTimestamp ?? 0) / 1000)}:R>`, inline: true },
      { name: 'Účet vytvorený', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Roly', value: target.roles.cache.filter(r => r.id !== interaction.guild!.id).map(r => `<@&${r.id}>`).join(', ') || '*žiadne*', inline: false },
    ).setColor(0x7c3aed).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  private async cmdServerinfo(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    await guild.fetch();
    const embed = new EmbedBuilder().setTitle(guild.name).setThumbnail(guild.iconURL()).addFields(
      { name: 'ID', value: guild.id, inline: true },
      { name: 'Vlastník', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Členovia', value: String(guild.memberCount), inline: true },
      { name: 'Kanály', value: String(guild.channels.cache.size), inline: true },
      { name: 'Roly', value: String(guild.roles.cache.size - 1), inline: true },
      { name: 'Vytvorený', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Úroveň boostov', value: String(guild.premiumTier), inline: true },
      { name: 'Boosty', value: String(guild.premiumSubscriptionCount ?? 0), inline: true },
    ).setColor(0x7c3aed).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  private async cmdAvatar(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🖼️ Avatar používateľa ${target.username}`).setImage(target.displayAvatarURL({ size: 512 })).setColor(0x7c3aed)] });
  }

  private async cmdSlowmode(interaction: ChatInputCommandInteraction) {
    const seconds = interaction.options.getInteger('seconds', true);
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.setRateLimitPerUser(seconds);
    await interaction.reply({ content: `✅ Pomalý režim nastavený na ${seconds}s v ${channel}.`, ephemeral: true });
  }

  private async cmdLock(interaction: ChatInputCommandInteraction) {
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.permissionOverwrites.edit(interaction.guild!.id, { SendMessages: false });
    await interaction.reply({ content: `🔒 ${channel} bol zamknutý.` });
  }

  private async cmdUnlock(interaction: ChatInputCommandInteraction) {
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.permissionOverwrites.edit(interaction.guild!.id, { SendMessages: null });
    await interaction.reply({ content: `🔓 ${channel} bol odomknutý.` });
  }

  private async cmdPing(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ content: '📡 Pinguje...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({ content: `🏓 Pong! Odozva: **${latency}ms** | API odozva: **${this.client!.ws.ping}ms**` });
  }

  private async cmdPoll(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString('question', true);
    const optionsStr = interaction.options.getString('options');
    const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    let description = '';
    let emojis: string[] = [];
    if (optionsStr) {
      const opts = optionsStr.split('|').map(s => s.trim()).slice(0, 10);
      emojis = numbers.slice(0, opts.length);
      description = opts.map((o, i) => `${emojis[i]} ${o}`).join('\n');
    } else {
      emojis = ['✅', '❌'];
      description = '✅ Áno\n❌ Nie';
    }

    const embed = new EmbedBuilder().setTitle(`📊 ${question}`).setDescription(description).setColor(0x7c3aed).setFooter({ text: `Anketa od ${interaction.user.tag}` }).setTimestamp();
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (const emoji of emojis) await (msg as Message).react(emoji).catch(() => {});
  }
}

export const discordBot = new DiscordBotService();
