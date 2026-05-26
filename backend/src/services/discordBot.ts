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
      new SlashCommandBuilder().setName('ticket-setup').setDescription('Create a ticket panel in a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel for the panel').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder().setName('ticket-close').setDescription('Close this ticket')
        .addStringOption(o => o.setName('reason').setDescription('Reason for closing').setRequired(false)),

      new SlashCommandBuilder().setName('warn').setDescription('Warn a member')
        .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('warns').setDescription('List warnings for a user')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('delwarn').setDescription('Delete a warning by ID')
        .addStringOption(o => o.setName('id').setDescription('Warning ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('ban').setDescription('Ban a member')
        .addUserOption(o => o.setName('user').setDescription('Member to ban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
        .addIntegerOption(o => o.setName('delete_messages').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

      new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID')
        .addStringOption(o => o.setName('user_id').setDescription('User ID').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

      new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
        .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

      new SlashCommandBuilder().setName('mute').setDescription('Timeout a member')
        .addUserOption(o => o.setName('user').setDescription('Member to mute').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 1h30m, 1d)').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('unmute').setDescription('Remove timeout from a member')
        .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

      new SlashCommandBuilder().setName('purge').setDescription('Delete messages in bulk')
        .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
        .addUserOption(o => o.setName('user').setDescription('Filter by user').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

      new SlashCommandBuilder().setName('giveaway').setDescription('Giveaway management')
        .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
          .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 1h, 2d)').setRequired(true))
          .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20).setRequired(true))
          .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
          .addChannelOption(o => o.setName('channel').setDescription('Channel (default: current)').setRequired(false)))
        .addSubcommand(s => s.setName('end').setDescription('End a giveaway early').addStringOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
        .addSubcommand(s => s.setName('reroll').setDescription('Reroll giveaway winners').addStringOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('List active giveaways'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

      new SlashCommandBuilder().setName('level').setDescription('Show your or another user\'s level')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(false)),

      new SlashCommandBuilder().setName('leaderboard').setDescription('Show the XP leaderboard'),

      new SlashCommandBuilder().setName('say').setDescription('Make the bot say something')
        .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Channel (default: current)').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

      new SlashCommandBuilder().setName('embed').setDescription('Send a custom embed')
        .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Embed description').setRequired(true))
        .addStringOption(o => o.setName('color').setDescription('Color hex (e.g. #7c3aed)').setRequired(false))
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

      new SlashCommandBuilder().setName('role').setDescription('Add or remove a role from a member')
        .addSubcommand(s => s.setName('add').setDescription('Add role')
          .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
          .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Remove role')
          .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
          .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

      new SlashCommandBuilder().setName('userinfo').setDescription('Show info about a user')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(false)),

      new SlashCommandBuilder().setName('serverinfo').setDescription('Show server info'),

      new SlashCommandBuilder().setName('avatar').setDescription('Show a user\'s avatar')
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(false)),

      new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode')
        .addIntegerOption(o => o.setName('seconds').setDescription('Seconds (0 to disable)').setMinValue(0).setMaxValue(21600).setRequired(true))
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

      new SlashCommandBuilder().setName('lock').setDescription('Lock a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

      new SlashCommandBuilder().setName('unlock').setDescription('Unlock a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

      new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),

      new SlashCommandBuilder().setName('poll').setDescription('Create a poll')
        .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
        .addStringOption(o => o.setName('options').setDescription('Options separated by | (e.g. Yes|No|Maybe)').setRequired(false))
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
      const msg = { content: '❌ An error occurred.', ephemeral: true };
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
      new ButtonBuilder().setCustomId('create_ticket').setLabel('📩 Open Ticket').setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket panel created in ${channel}`, ephemeral: true });
  }

  private async handleCreateTicket(interaction: ButtonInteraction) {
    const config = db.prepare('SELECT * FROM discord_ticket_config WHERE id = ?').get('main') as TicketConfig;
    if (!config.enabled) { await interaction.reply({ content: '❌ Ticket system is disabled.', ephemeral: true }); return; }

    const guild = interaction.guild!;
    const user = interaction.user;

    const existingTicket = db.prepare("SELECT * FROM discord_tickets WHERE user_id = ? AND status = 'open'").get(user.id);
    if (existingTicket) { await interaction.reply({ content: '❌ You already have an open ticket!', ephemeral: true }); return; }

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
    const embed = new EmbedBuilder().setTitle('🎫 Ticket Opened').setDescription(welcome).setColor(0x7c3aed).setFooter({ text: `Ticket ID: ${ticketId.slice(0, 8)}` }).setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: `<@${user.id}>${config.support_role_id ? ` <@&${config.support_role_id}>` : ''}`, embeds: [embed], components: [row] });
    await interaction.editReply({ content: `✅ Your ticket has been created: ${channel}` });
  }

  private async cmdTicketClose(interaction: ChatInputCommandInteraction) {
    const ticket = db.prepare("SELECT * FROM discord_tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId) as { id: string; user_id: string } | undefined;
    if (!ticket) { await interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true }); return; }
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    await this.closeTicket(interaction, ticket.id, reason);
  }

  private async handleCloseTicket(interaction: ButtonInteraction) {
    const ticket = db.prepare("SELECT * FROM discord_tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId) as { id: string } | undefined;
    if (!ticket) { await interaction.reply({ content: '❌ Ticket not found.', ephemeral: true }); return; }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('confirm_close_ticket').setLabel('✅ Confirm Close').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_close_ticket').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: 'Are you sure you want to close this ticket?', components: [row], ephemeral: true });
  }

  private async handleConfirmCloseTicket(interaction: ButtonInteraction) {
    const ticket = db.prepare("SELECT * FROM discord_tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId) as { id: string } | undefined;
    if (!ticket) { await interaction.update({ content: '❌ Ticket not found.', components: [] }); return; }
    await interaction.update({ content: 'Closing ticket...', components: [] });
    await this.closeTicket(interaction, ticket.id, 'Closed by user');
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
        const embed = new EmbedBuilder().setTitle('🎫 Ticket Closed').addFields(
          { name: 'Channel', value: channel.name, inline: true },
          { name: 'Closed by', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason, inline: false },
        ).setColor(0xef4444).setTimestamp();
        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    await channel.send({ embeds: [new EmbedBuilder().setDescription(`🔒 Ticket closed by ${interaction.user.tag}. Reason: ${reason}`).setColor(0xef4444)] });
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
    const embed = new EmbedBuilder().setTitle('⚠️ Member Warned').addFields(
      { name: 'Member', value: `${target.user.tag}`, inline: true },
      { name: 'Moderator', value: interaction.user.tag, inline: true },
      { name: 'Reason', value: reason, inline: false },
      { name: 'Total Warns', value: String(warns), inline: true },
      { name: 'Warn ID', value: id.slice(0, 8), inline: true },
    ).setColor(0xf59e0b).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    try { await target.send({ embeds: [new EmbedBuilder().setTitle(`⚠️ You were warned in ${interaction.guild!.name}`).setDescription(`**Reason:** ${reason}`).setColor(0xf59e0b)] }); } catch {}
  }

  private async cmdWarns(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const warns = db.prepare('SELECT * FROM discord_warns WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(target.id) as { id: string; reason: string; moderator_username: string; created_at: string }[];
    const embed = new EmbedBuilder().setTitle(`⚠️ Warnings for ${target.username}`).setColor(0xf59e0b);
    if (warns.length === 0) embed.setDescription('No warnings found.');
    else embed.setDescription(warns.map((w, i) => `**${i + 1}.** \`${w.id.slice(0, 8)}\` - ${w.reason}\n*by ${w.moderator_username} • ${new Date(w.created_at).toLocaleDateString()}*`).join('\n\n'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async cmdDelwarn(interaction: ChatInputCommandInteraction) {
    const id = interaction.options.getString('id', true);
    const warn = db.prepare('SELECT * FROM discord_warns WHERE id LIKE ?').get(`${id}%`) as { id: string } | undefined;
    if (!warn) { await interaction.reply({ content: '❌ Warning not found.', ephemeral: true }); return; }
    db.prepare('DELETE FROM discord_warns WHERE id = ?').run(warn.id);
    await interaction.reply({ content: `✅ Warning \`${warn.id.slice(0, 8)}\` deleted.`, ephemeral: true });
  }

  private async cmdBan(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember | null;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const delDays = interaction.options.getInteger('delete_messages') ?? 0;
    if (!target) { await interaction.reply({ content: '❌ Member not found.', ephemeral: true }); return; }
    await target.ban({ reason, deleteMessageSeconds: delDays * 86400 });
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason) VALUES ('ban', ?, ?, ?, ?, ?)").run(target.user.id, target.user.username, interaction.user.id, interaction.user.username, reason);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔨 Member Banned').addFields({ name: 'Member', value: target.user.tag, inline: true }, { name: 'Reason', value: reason }).setColor(0xef4444).setTimestamp()] });
  }

  private async cmdUnban(interaction: ChatInputCommandInteraction) {
    const userId = interaction.options.getString('user_id', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    await interaction.guild!.members.unban(userId, reason);
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason) VALUES ('unban', ?, 'Unknown', ?, ?, ?)").run(userId, interaction.user.id, interaction.user.username, reason);
    await interaction.reply({ content: `✅ User \`${userId}\` has been unbanned.` });
  }

  private async cmdKick(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember | null;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    if (!target) { await interaction.reply({ content: '❌ Member not found.', ephemeral: true }); return; }
    await target.kick(reason);
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason) VALUES ('kick', ?, ?, ?, ?, ?)").run(target.user.id, target.user.username, interaction.user.id, interaction.user.username, reason);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('👢 Member Kicked').addFields({ name: 'Member', value: target.user.tag }, { name: 'Reason', value: reason }).setColor(0xf97316).setTimestamp()] });
  }

  private async cmdMute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember | null;
    const durStr = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const durMs = parseDuration(durStr);
    if (!target || !durMs) { await interaction.reply({ content: '❌ Invalid member or duration.', ephemeral: true }); return; }
    await target.timeout(durMs, reason);
    db.prepare("INSERT INTO discord_mod_logs (action, user_id, username, moderator_id, moderator_username, reason, duration) VALUES ('mute', ?, ?, ?, ?, ?, ?)").run(target.user.id, target.user.username, interaction.user.id, interaction.user.username, reason, formatDuration(durMs));
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔇 Member Muted').addFields({ name: 'Member', value: target.user.tag, inline: true }, { name: 'Duration', value: formatDuration(durMs), inline: true }, { name: 'Reason', value: reason }).setColor(0x6366f1).setTimestamp()] });
  }

  private async cmdUnmute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember | null;
    if (!target) { await interaction.reply({ content: '❌ Member not found.', ephemeral: true }); return; }
    await target.timeout(null);
    await interaction.reply({ content: `✅ ${target.user.tag} has been unmuted.` });
  }

  private async cmdPurge(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');
    const channel = interaction.channel as TextChannel;
    let messages = await channel.messages.fetch({ limit: amount + 1 });
    if (user) messages = messages.filter(m => m.author.id === user.id);
    const deleted = await channel.bulkDelete(messages, true);
    await interaction.reply({ content: `✅ Deleted ${deleted.size} message(s).`, ephemeral: true });
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
    if (!durMs) { await interaction.reply({ content: '❌ Invalid duration format. Use: 1h, 30m, 1d', ephemeral: true }); return; }

    const id = uuidv4();
    const endsAt = new Date(Date.now() + durMs).toISOString();

    const embed = new EmbedBuilder()
      .setTitle('🎉 GIVEAWAY!')
      .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Hosted by:** ${interaction.user}\n**Ends:** <t:${Math.floor((Date.now() + durMs) / 1000)}:R>`)
      .setColor(0x7c3aed)
      .setFooter({ text: `ID: ${id.slice(0, 8)} • React 🎉 to enter` })
      .setTimestamp(new Date(endsAt));

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('giveaway_enter').setLabel('🎉 Enter (0)').setStyle(ButtonStyle.Primary)
    );

    const msg = await targetChannel.send({ embeds: [embed], components: [row] });
    db.prepare('INSERT INTO discord_giveaways (id, channel_id, message_id, prize, winners_count, host_id, host_username, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, targetChannel.id, msg.id, prize, winners, interaction.user.id, interaction.user.username, endsAt);
    await interaction.reply({ content: `✅ Giveaway started in ${targetChannel}!`, ephemeral: true });

    const timer = setTimeout(() => this.endGiveawayById(id), durMs);
    this.giveawayTimers.set(id, timer);
  }

  private async handleGiveawayEnter(interaction: ButtonInteraction) {
    const giveaway = db.prepare("SELECT * FROM discord_giveaways WHERE message_id = ? AND ended = 0 AND cancelled = 0").get(interaction.message.id) as Giveaway | undefined;
    if (!giveaway) { await interaction.reply({ content: '❌ This giveaway has ended.', ephemeral: true }); return; }

    const entries: string[] = JSON.parse(giveaway.entries);
    if (entries.includes(interaction.user.id)) {
      const idx = entries.indexOf(interaction.user.id);
      entries.splice(idx, 1);
      db.prepare('UPDATE discord_giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), giveaway.id);
      await interaction.reply({ content: '✅ You left the giveaway.', ephemeral: true });
    } else {
      entries.push(interaction.user.id);
      db.prepare('UPDATE discord_giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), giveaway.id);
      await interaction.reply({ content: '🎉 You entered the giveaway!', ephemeral: true });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('giveaway_enter').setLabel(`🎉 Enter (${entries.length})`).setStyle(ButtonStyle.Primary)
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

    const winnerMentions = winnerIds.length > 0 ? winnerIds.map(w => `<@${w}>`).join(', ') : 'No winners (no entries)';
    const msg = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (msg) {
      const embed = new EmbedBuilder().setTitle('🎉 GIVEAWAY ENDED').setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winnerMentions}\n**Hosted by:** <@${giveaway.host_id}>`).setColor(0x6b7280).setFooter({ text: `ID: ${id.slice(0, 8)}` }).setTimestamp();
      await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    }

    if (winnerIds.length > 0) await channel.send({ content: `🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!` });
    else await channel.send({ content: `😔 No winners for **${giveaway.prize}** (no entries).` });
  }

  private async endGiveaway(interaction: ChatInputCommandInteraction) {
    const id = interaction.options.getString('id', true);
    const giveaway = db.prepare('SELECT * FROM discord_giveaways WHERE id LIKE ? AND ended = 0').get(`${id}%`) as Giveaway | undefined;
    if (!giveaway) { await interaction.reply({ content: '❌ Active giveaway not found.', ephemeral: true }); return; }
    const timer = this.giveawayTimers.get(giveaway.id);
    if (timer) clearTimeout(timer);
    await this.endGiveawayById(giveaway.id);
    await interaction.reply({ content: '✅ Giveaway ended!', ephemeral: true });
  }

  private async rerollGiveaway(interaction: ChatInputCommandInteraction) {
    const id = interaction.options.getString('id', true);
    const giveaway = db.prepare('SELECT * FROM discord_giveaways WHERE id LIKE ? AND ended = 1').get(`${id}%`) as Giveaway | undefined;
    if (!giveaway) { await interaction.reply({ content: '❌ Ended giveaway not found.', ephemeral: true }); return; }
    const entries: string[] = JSON.parse(giveaway.entries);
    if (!entries.length) { await interaction.reply({ content: '❌ No entries to reroll.', ephemeral: true }); return; }
    const winner = entries[Math.floor(Math.random() * entries.length)];
    const channel = interaction.channel as TextChannel;
    await channel.send({ content: `🎉 New winner: <@${winner}>! Congratulations on winning **${giveaway.prize}**!` });
    await interaction.reply({ content: '✅ Rerolled!', ephemeral: true });
  }

  private async listGiveaways(interaction: ChatInputCommandInteraction) {
    const giveaways = db.prepare('SELECT * FROM discord_giveaways WHERE ended = 0 AND cancelled = 0 ORDER BY ends_at ASC LIMIT 10').all() as Giveaway[];
    const embed = new EmbedBuilder().setTitle('🎉 Active Giveaways').setColor(0x7c3aed);
    if (!giveaways.length) embed.setDescription('No active giveaways.');
    else embed.setDescription(giveaways.map(g => `**${g.prize}** - ${g.winners_count} winner(s)\n\`${g.id.slice(0, 8)}\` • Ends <t:${Math.floor(new Date(g.ends_at).getTime() / 1000)}:R>`).join('\n\n'));
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

      await msg.channel.send({ embeds: [new EmbedBuilder().setDescription(`🎉 Congrats ${msg.author}! You reached **Level ${newLevel}**!`).setColor(0x7c3aed)] }).catch(() => {});
    }
  }

  private async cmdLevel(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const row = db.prepare('SELECT * FROM discord_levels WHERE user_id = ?').get(target.id) as { xp: number; level: number; messages: number } | undefined;
    const xp = row?.xp ?? 0; const level = row?.level ?? 0; const messages = row?.messages ?? 0;
    const xpNeeded = xpForLevel(level);
    const bar = '█'.repeat(Math.floor((xp / xpNeeded) * 10)) + '░'.repeat(10 - Math.floor((xp / xpNeeded) * 10));
    const embed = new EmbedBuilder().setTitle(`📊 ${target.username}'s Level`).setThumbnail(target.displayAvatarURL()).addFields(
      { name: 'Level', value: String(level), inline: true },
      { name: 'XP', value: `${xp}/${xpNeeded}`, inline: true },
      { name: 'Messages', value: String(messages), inline: true },
      { name: 'Progress', value: `\`${bar}\` ${Math.floor((xp / xpNeeded) * 100)}%`, inline: false },
    ).setColor(0x7c3aed);
    await interaction.reply({ embeds: [embed] });
  }

  private async cmdLeaderboard(interaction: ChatInputCommandInteraction) {
    const rows = db.prepare('SELECT * FROM discord_levels ORDER BY level DESC, xp DESC LIMIT 10').all() as { user_id: string; username: string; level: number; xp: number; messages: number }[];
    const embed = new EmbedBuilder().setTitle('🏆 XP Leaderboard').setColor(0x7c3aed);
    const medals = ['🥇', '🥈', '🥉'];
    if (!rows.length) embed.setDescription('No data yet.');
    else embed.setDescription(rows.map((r, i) => `${medals[i] ?? `**${i + 1}.**`} <@${r.user_id}> — Level **${r.level}** • ${r.xp} XP`).join('\n'));
    await interaction.reply({ embeds: [embed] });
  }

  // ─── REACTION ROLES ────────────────────────────────────────────────────────

  private async handleReactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
    const rr = db.prepare('SELECT * FROM discord_reaction_roles WHERE message_id = ? AND emoji = ?').get(reaction.message.id, reaction.emoji.name ?? reaction.emoji.id ?? '') as { role_id: string } | undefined;
    if (!rr || !reaction.message.guild) return;
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    const role = reaction.message.guild.roles.cache.get(rr.role_id);
    if (member && role) await member.roles.add(role).catch(() => {});
  }

  private async handleReactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
    const rr = db.prepare('SELECT * FROM discord_reaction_roles WHERE message_id = ? AND emoji = ?').get(reaction.message.id, reaction.emoji.name ?? reaction.emoji.id ?? '') as { role_id: string } | undefined;
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
    if (badWords.some(w => content.includes(w.toLowerCase()))) { violated = true; reason = 'Bad word'; }

    // Anti-links
    if (!violated && config.anti_links && /https?:\/\//.test(msg.content)) {
      if (!msg.member?.permissions.has(PermissionFlagsBits.ManageMessages)) { violated = true; reason = 'Links not allowed'; }
    }

    // Anti-invites
    if (!violated && config.anti_invites && /discord\.gg\/\w+/i.test(msg.content)) { violated = true; reason = 'Discord invites not allowed'; }

    // Anti-spam
    if (!violated && config.anti_spam) {
      const key = `${msg.author.id}:${msg.channelId}`;
      const times = this.spamTracker.get(key) ?? [];
      const now = Date.now();
      const filtered = times.filter(t => now - t < config.spam_interval * 1000);
      filtered.push(now);
      this.spamTracker.set(key, filtered);
      if (filtered.length >= config.spam_threshold) { violated = true; reason = 'Spam detected'; }
    }

    if (violated) {
      await msg.delete().catch(() => {});
      const warn = await msg.channel.send({ content: `⚠️ ${msg.author}, your message was removed: **${reason}**` }).catch(() => null);
      if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
      if (config.log_channel) {
        const logCh = msg.guild.channels.cache.get(config.log_channel) as TextChannel | undefined;
        if (logCh) await logCh.send({ embeds: [new EmbedBuilder().setTitle('🛡️ Automod').addFields({ name: 'User', value: msg.author.tag, inline: true }, { name: 'Reason', value: reason, inline: true }, { name: 'Channel', value: `<#${msg.channelId}>`, inline: true }, { name: 'Content', value: msg.content.slice(0, 200) }).setColor(0xef4444).setTimestamp()] }).catch(() => {});
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
    await ch.send({ embeds: [new EmbedBuilder().setTitle('🗑️ Message Deleted').addFields({ name: 'Author', value: msg.author?.tag ?? 'Unknown', inline: true }, { name: 'Channel', value: `<#${msg.channelId}>`, inline: true }, { name: 'Content', value: msg.content?.slice(0, 1000) || '*no content*' }).setColor(0xef4444).setTimestamp()] }).catch(() => {});
  }

  private async logMessageUpdate(oldMsg: Message, newMsg: Message) {
    if (!newMsg.guild || newMsg.author?.bot || oldMsg.content === newMsg.content) return;
    const ch = await this.getLogChannel('message_edit_channel', newMsg.guild);
    if (!ch) return;
    await ch.send({ embeds: [new EmbedBuilder().setTitle('✏️ Message Edited').addFields({ name: 'Author', value: newMsg.author?.tag ?? 'Unknown', inline: true }, { name: 'Channel', value: `<#${newMsg.channelId}>`, inline: true }, { name: 'Before', value: oldMsg.content?.slice(0, 500) || '*empty*' }, { name: 'After', value: newMsg.content?.slice(0, 500) || '*empty*' }).setColor(0xf59e0b).setTimestamp()] }).catch(() => {});
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
    const embed = new EmbedBuilder().setTitle('👑 Roles Updated').addFields({ name: 'Member', value: newMember.user.tag, inline: true });
    if (added.size) embed.addFields({ name: '+ Added', value: added.map(r => `<@&${r.id}>`).join(', '), inline: true });
    if (removed?.size) embed.addFields({ name: '- Removed', value: removed.map(r => `<@&${r.id}>`).join(', '), inline: true });
    await ch.send({ embeds: [embed.setColor(0xa78bfa).setTimestamp()] }).catch(() => {});
  }

  private async logBanEvent(ban: GuildBan, action: 'ban' | 'unban') {
    const ch = await this.getLogChannel('ban_channel', ban.guild);
    if (!ch) return;
    const embed = new EmbedBuilder().setTitle(action === 'ban' ? '🔨 Member Banned' : '✅ Member Unbanned').addFields({ name: 'User', value: ban.user.tag, inline: true }, { name: 'User ID', value: ban.user.id, inline: true }).setColor(action === 'ban' ? 0xef4444 : 0x22c55e).setTimestamp();
    if (ban.reason) embed.addFields({ name: 'Reason', value: ban.reason });
    await ch.send({ embeds: [embed] }).catch(() => {});
  }

  // ─── UTILITY COMMANDS ──────────────────────────────────────────────────────

  private async cmdSay(interaction: ChatInputCommandInteraction) {
    const message = interaction.options.getString('message', true);
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.send(message);
    await interaction.reply({ content: '✅ Message sent.', ephemeral: true });
  }

  private async cmdEmbed(interaction: ChatInputCommandInteraction) {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const color = interaction.options.getString('color') ?? '#7c3aed';
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(description).setColor(parseInt(color.replace('#', ''), 16)).setTimestamp()] });
    await interaction.reply({ content: '✅ Embed sent.', ephemeral: true });
  }

  private async cmdRole(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getMember('user') as GuildMember;
    const role = interaction.options.getRole('role')!;
    if (sub === 'add') { await target.roles.add(role.id); await interaction.reply({ content: `✅ Added ${role} to ${target.user.tag}.` }); }
    else { await target.roles.remove(role.id); await interaction.reply({ content: `✅ Removed ${role} from ${target.user.tag}.` }); }
  }

  private async cmdUserinfo(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember ?? interaction.member as GuildMember;
    const user = target.user;
    const embed = new EmbedBuilder().setTitle(`👤 ${user.username}`).setThumbnail(user.displayAvatarURL()).addFields(
      { name: 'ID', value: user.id, inline: true },
      { name: 'Tag', value: user.tag, inline: true },
      { name: 'Nickname', value: target.nickname ?? '*none*', inline: true },
      { name: 'Joined Server', value: `<t:${Math.floor((target.joinedTimestamp ?? 0) / 1000)}:R>`, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Roles', value: target.roles.cache.filter(r => r.id !== interaction.guild!.id).map(r => `<@&${r.id}>`).join(', ') || '*none*', inline: false },
    ).setColor(0x7c3aed).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  private async cmdServerinfo(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    await guild.fetch();
    const embed = new EmbedBuilder().setTitle(guild.name).setThumbnail(guild.iconURL()).addFields(
      { name: 'ID', value: guild.id, inline: true },
      { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Members', value: String(guild.memberCount), inline: true },
      { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
      { name: 'Roles', value: String(guild.roles.cache.size - 1), inline: true },
      { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Boost Level', value: String(guild.premiumTier), inline: true },
      { name: 'Boosts', value: String(guild.premiumSubscriptionCount ?? 0), inline: true },
    ).setColor(0x7c3aed).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  private async cmdAvatar(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🖼️ ${target.username}'s Avatar`).setImage(target.displayAvatarURL({ size: 512 })).setColor(0x7c3aed)] });
  }

  private async cmdSlowmode(interaction: ChatInputCommandInteraction) {
    const seconds = interaction.options.getInteger('seconds', true);
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.setRateLimitPerUser(seconds);
    await interaction.reply({ content: `✅ Slowmode set to ${seconds}s in ${channel}.`, ephemeral: true });
  }

  private async cmdLock(interaction: ChatInputCommandInteraction) {
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.permissionOverwrites.edit(interaction.guild!.id, { SendMessages: false });
    await interaction.reply({ content: `🔒 ${channel} has been locked.` });
  }

  private async cmdUnlock(interaction: ChatInputCommandInteraction) {
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    await channel.permissionOverwrites.edit(interaction.guild!.id, { SendMessages: null });
    await interaction.reply({ content: `🔓 ${channel} has been unlocked.` });
  }

  private async cmdPing(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ content: '📡 Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({ content: `🏓 Pong! Latency: **${latency}ms** | API: **${this.client!.ws.ping}ms**` });
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
      description = '✅ Yes\n❌ No';
    }

    const embed = new EmbedBuilder().setTitle(`📊 ${question}`).setDescription(description).setColor(0x7c3aed).setFooter({ text: `Poll by ${interaction.user.tag}` }).setTimestamp();
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (const emoji of emojis) await (msg as Message).react(emoji).catch(() => {});
  }
}

export const discordBot = new DiscordBotService();
