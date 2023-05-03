const noblox = require("noblox.js")
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const config = require("./config.json")
 
setInterval(function() {
    console.log("🔔 | This is a free project, please consider supporting me by following me on Roblox( https://rblx.name/1667282355 ) with a follow.");
  }, 30000);

async function startApp () {
    const currentUser = await noblox.setCookie(config.ROBLOX_TOKEN) 

    const transactionEvent = noblox.onGroupTransaction(config.GROUP_ID, "Sale")

    transactionEvent.on("data", async function(data) {
        console.log("💸 | New Transaction!", data)

        let playerThumbnail = await noblox.getPlayerThumbnail(data.agent.id, 420, "png", false, "Headshot")
        let information = await noblox.getPlayerInfo({userId: data.agent.id})

        client.channels.cache.get(config.CHANNEL_ID).send({ 
            embeds: [{
                "title": "Profile",
                "description": "\n`🛸` **User Id:**  " + data.agent.id +"\n`💎`**Username:**  " + data.agent.name +"\n**`🌊`DisplayName:**  " + information.displayName +"\n`🛍️` **Product Name:**  " + data.details.name +"\n**`💸` Product Price:**  " + data.currency.amount +" Robux",
                "url": "https://www.roblox.com/users/" + data.agent.id + "/profile",
                "color": 16777215,
                "thumbnail": { 
                    "url": playerThumbnail[0].imageUrl 
                },
                "footer": {
                    "text": "• Rayro's Tools",
                    "icon_url": "https://cdn.discordapp.com/attachments/1093252684221530124/1103291490739957770/7197be9c7fe0c523b1862e2623f03024.png"
                }
            }]
        });
    })

    transactionEvent.on("error", function(err) {
     console.error("⏰ | Timed out...")
    })

    console.log(`🐳 | Logged in as ${currentUser.UserName} [${currentUser.UserID}]`)
 
    client.on('ready', async () => {
        console.log("🔒 | Logged in as " + client.user.tag);
    });

    client.login(config.BOT_TOKEN);
}

startApp()
