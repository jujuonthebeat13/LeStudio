const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require("discord.js");

// ===== INIT CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG =====
const GUILD_ID = "1458135503974170788";

const CREATIVE_ROLE_IDS = [
  "1458140072221343846",
  "1458284994345570538",
  "1458140485393842207",
  "1458140400559722558",
  "1458285431165554910",
  "1458285481417638020",
  "1458285599101288559",
  "1458285657423085764"
];

// ===== READY =====
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);

  // Cache complet des membres (important pour role.members)
  await guild.members.fetch();

  // 🔥 UNE SEULE SLASH COMMAND
  await guild.commands.set([
    new SlashCommandBuilder()
      .setName("find-collabs")
      .setDescription("Find members by creative role")
  ]);

  console.log("✅ Slash command /find-collabs registered");
});

// ===== INTERACTIONS =====
client.on(Events.InteractionCreate, async interaction => {

  // ───── /find-collabs ─────
  if (interaction.isChatInputCommand() && interaction.commandName === "find-collabs") {
    await interaction.deferReply({ ephemeral: true });

    // Cache des rôles
    await interaction.guild.roles.fetch();

    const roles = CREATIVE_ROLE_IDS
      .map(id => interaction.guild.roles.cache.get(id))
      .filter(Boolean)
      .map(role => ({
        label: role.name.slice(0, 100),
        value: role.id
      }));

    if (roles.length === 0) {
      return interaction.editReply({
        content: "❌ No creative roles found."
      });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId("collab-role")
      .setPlaceholder("Select a creative role")
      .addOptions(roles);

    await interaction.editReply({
      content: "🎨 Choose a role:",
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // ───── ROLE SELECT MENU ─────
  if (interaction.isStringSelectMenu() && interaction.customId === "collab-role") {
    const role = interaction.guild.roles.cache.get(interaction.values[0]);
    if (!role) {
      return interaction.update({
        content: "❌ Role not found.",
        components: []
      });
    }

    const members = role.members.map(m => `<@${m.id}>`);

    if (members.length === 0) {
      return interaction.update({
        content: "👻 No members have this role.",
        components: []
      });
    }

    const chunkSize = 25;

    for (let i = 0; i < members.length; i += chunkSize) {
      const chunk = members.slice(i, i + chunkSize).join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`🎨 ${role.name}`)
        .setDescription(chunk)
        .setColor(0xD10C0C)
        .setFooter({
          text: `Page ${Math.floor(i / chunkSize) + 1} / ${Math.ceil(members.length / chunkSize)}`
        });

      if (i === 0) {
        await interaction.update({
          embeds: [embed],
          components: []
        });
      } else {
        await interaction.followUp({
          embeds: [embed],
          ephemeral: true
        });
      }
    }
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
