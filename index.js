//require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

// ===== INIT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ========= CONFIG =========
const GUILD_ID = "1458135503974170788";
const THREAD_ID = "1461146580148158589";

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

const eventCache = new Map();
const colors = {
  red: 0xFF0000,
  blue: 0x0000FF,
  purple: 0x800080
};
const DEFAULT_COLOR = 0x00FF00;

// ========= READY =========
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
 await guild.members.fetch(); // fetch complet AU LANCEMENT
 
  await guild.commands.set([
    new SlashCommandBuilder()
      .setName("find-collabs")
      .setDescription("Find members by creative role"),
    new SlashCommandBuilder()
      .setName("create-event")
      .setDescription("Create an event post (simple)")
  ]);

  console.log("✅ Slash commands registered");
});

// ========= INTERACTIONS =========
client.on(Events.InteractionCreate, async interaction => {

  // ---- /find-collabs ----
  if (interaction.isChatInputCommand() && interaction.commandName === "find-collabs") {
    await interaction.deferReply({ ephemeral: true });

    // fetch seulement les rôles
    await interaction.guild.roles.fetch();

    const roles = CREATIVE_ROLE_IDS
      .map(id => interaction.guild.roles.cache.get(id))
      .filter(Boolean)
      .map(r => ({ label: r.name.substring(0, 100), value: r.id }));

    if (roles.length === 0) return interaction.editReply({ content: "No roles found." });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("collab-role")
      .setPlaceholder("Select a role")
      .addOptions(roles);

    await interaction.editReply({
      content: "Choose a role:",
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // ---- ROLE MENU ----
  if (interaction.isStringSelectMenu() && interaction.customId === "collab-role") {
  const role = interaction.guild.roles.cache.get(interaction.values[0]);
  if (!role) return interaction.update({ content: "Role not found.", components: [] });

  // ⚡ Utiliser uniquement le cache
  const members = role.members.map(m => `<@${m.id}>`);

  // Pagination si >25 membres
  const chunkSize = 25;
  for (let i = 0; i < members.length; i += chunkSize) {
    const chunk = members.slice(i, i + chunkSize).join("\n");

    const embed = new EmbedBuilder()
      .setTitle(role.name)
      .setDescription(chunk.length ? chunk : "No members found")
      .setColor(0xD10C0C)
      .setFooter({ text: `Page ${Math.floor(i/chunkSize)+1} of ${Math.ceil(members.length/chunkSize)}` });

    if (i === 0) {
      await interaction.update({ embeds: [embed], components: [] });
    } else {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    }
  }
}

  // ───── /create-event ─────
  if (interaction.isChatInputCommand() && interaction.commandName === "create-event") {
    const modal = new ModalBuilder()
      .setCustomId("event_step1")
      .setTitle("Create Event – Step 1");

    modal.addComponents(
      row("name", "Event name", TextInputStyle.Short),
      row("description", "Description", TextInputStyle.Paragraph),
      row("date", "Date (dd/mm/yyyy)", TextInputStyle.Short),
      row("time", "Time (24h)", TextInputStyle.Short),
      row("location", "Location", TextInputStyle.Short)
    );

    await interaction.showModal(modal);
  }

  // ───── MODAL STEP 1 ─────
  if (interaction.isModalSubmit() && interaction.customId === "event_step1") {
    eventCache.set(interaction.user.id, {
      name: interaction.fields.getTextInputValue("name"),
      description: interaction.fields.getTextInputValue("description"),
      date: interaction.fields.getTextInputValue("date"),
      time: interaction.fields.getTextInputValue("time"),
      location: interaction.fields.getTextInputValue("location")
    });

    const button = new ButtonBuilder()
      .setCustomId("event_continue")
      .setLabel("Continue ➜")
      .setStyle(ButtonStyle.Primary);

    await interaction.reply({
      content: "✅ Step 1 saved. Continue to step 2.",
      components: [new ActionRowBuilder().addComponents(button)],
      ephemeral: true
    });
  }

  // ───── BUTTON → STEP 2 ─────
  if (interaction.isButton() && interaction.customId === "event_continue") {
    const modal = new ModalBuilder()
      .setCustomId("event_step2")
      .setTitle("Create Event – Step 2");

    modal.addComponents(
      row("tickets", "Ticket link (optional)", TextInputStyle.Short, false),
      row("external", "External link (optional)", TextInputStyle.Short, false),
      row("poster", "Poster image URL", TextInputStyle.Short, false),
      row("color", "Color (red / blue / purple)", TextInputStyle.Short, false)
    );

    await interaction.showModal(modal);
  }

  // ───── MODAL STEP 2 → CREATE EMBED ─────
  if (interaction.isModalSubmit() && interaction.customId === "event_step2") {
    const base = eventCache.get(interaction.user.id);
    if (!base) return interaction.reply({ content: "❌ Event data not found.", ephemeral: true });

    const tickets = interaction.fields.getTextInputValue("tickets");
    const external = interaction.fields.getTextInputValue("external");
    const poster = interaction.fields.getTextInputValue("poster");
    const colorInput = interaction.fields.getTextInputValue("color")?.toLowerCase();

    const embed = new EmbedBuilder()
      .setTitle(base.name)
      .setDescription(base.description)
      .setColor(colors[colorInput] || DEFAULT_COLOR)
      .addFields(
        { name: "**Date**", value: formatDate(base.date), inline: false },
        { name: "**Time**", value: base.time, inline: false },
        { name: "**Location**", value: base.location, inline: false }
      )
      .setFooter({ text: `Posted by ${interaction.user.tag}` });

    if (tickets) embed.addFields({ name: "**Get Tickets**", value: tickets.startsWith("http") ? `[Click here](${tickets})` : tickets, inline: false });
    if (external) embed.addFields({ name: "**More information**", value: external.startsWith("http") ? `[Learn more](${external})` : external, inline: false });
    if (poster && poster.startsWith("http")) embed.setImage(poster);

    // Poste dans le thread existant
    const thread = await client.channels.fetch(THREAD_ID);
    await thread.send({ embeds: [embed] });

    await interaction.reply({ content: "✅ Event created!", ephemeral: true });
  }

});

// ===== HELPER =====
function row(id, label, style, required = true) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required)
  );
}

function formatDate(input) {
  const [day, month, year] = input.split("/");
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

// ========= LOGIN =========

client.login(process.env.DISCORD_TOKEN);
