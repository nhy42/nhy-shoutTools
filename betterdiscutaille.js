const mdp = makeMDP();
mdp.addInlineSyntax ({	// this is sample for img
    tag: "IG",
    priority: 60,
    provisionalText: '<img url="$2" alt="$1"></img>',
    matchRegex: new RegExp("!\\[(.+?)\\]\\((.+?)\\)", 'g'),
    converter: function ( argBlock ) {
        return null;
    },
    convertedHTML: new Array()
});
mdp.removeBlockSyntax("PP");

function log(message) {
    console.log("[BETTER DISCUTAILLE] " + message);
}

const TAGS = [
    {
        class: "bot",
        value: "BOT",
        admin: false
    },
    {
        class: "system",
        value: "SYSTÈME",
        admin: true
    }
]

let config = {};

function saveKnownUser(pseudo, status) {
    let user = config.known_users.find(u => u.pseudo === pseudo);
    if (user === undefined) {
        user = {
            pseudo: pseudo,
            statuses: []
        };
        config.known_users.push(user);
    }
    if (!user.statuses.includes(status)) {
        user.statuses.push(status);
    }
    saveConfig();
}

function saveConfig() {
    window.localStorage.setItem("config", JSON.stringify(config));
}

function loadConfig() {
    if (window.localStorage.getItem("config") === null) {
        config = {
            "pseudo": "",
            "status": "",
            "known_users": []
        };
        saveConfig();
    }
    config = JSON.parse(window.localStorage.getItem("config"));
}
loadConfig();

function parseMd(md) {
    return mdp.render(md).trim();
}

function parseLinks(msg) {
    return msg.replaceAll(/(?<!href=")(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
}

function parseMessage(msg) {
    msg = parseMd(msg);
    msg = parseLinks(msg);
    const mentions = [];
    for (let i in msg) {
        const char = msg.charAt(i);
        if (char === "@") {
            // detect mentions
            const mentionable = [];
            // detect pseudo from known users (config.known_users.map(u => u.pseudo)) even when the pseudo contains spaces
            for (let u of config.known_users) {
                const pseudodata = parseSmallPseudo(u.pseudo);
                const p = pseudodata.withoutTags;
                const d = msg.slice(parseInt(i) + 1, parseInt(i) + p.length + 1);
                if (d === p) {
                    mentionable.push(p);
                }
            }
            if (mentionable.length > 0) {
                const pseudo = mentionable.sort((a, b) => b.length - a.length)[0];
                mentions.push({
                    pseudo: pseudo,
                    index: parseInt(i)
                });
            }
        }
    }

    for (let mention of mentions.sort((a, b) => b.index - a.index)) {
        const pseudo = mention.pseudo;
        const index = mention.index;
        msg = msg.slice(0, index) + `<span class="mention">@${pseudo}</span>` + msg.slice(index + pseudo.length + 1);
    }

    if (mentions.map(m => m.pseudo).includes(config.pseudo)) {
        msg = `<span class="mentioned-message">${msg}</span>`;
    }
    else {
        msg = `<span class="normal-message">${msg}</span>`;
    }

    return msg;
}

function parsePseudo(text, isAdmin) {
    let pseudo;
    let status = "";
    let parsedPseudo;
    if (text.includes(" | ")) {
        pseudo = text.split(" | ")[0];
        status = text.split(" | ")[1];
        parsedPseudo = `<span class="author-container"><span class="author-data"><span class="author-pseudo">${pseudo}</span><span class="author-status">${status}</span></span></span>`;
    }
    else {
        pseudo = text;
        parsedPseudo = `<span class="author-container"><span class="author-data"><span class="author-pseudo">${pseudo}</span></span></span>`;
    }
    saveKnownUser(pseudo, status);
    for (let tag of TAGS) {
        if (pseudo.endsWith(tag.value)) {
            if (tag.admin && !isAdmin) {
                parsedPseudo = parsedPseudo.replace(tag.value, "");
            }
            else {
                parsedPseudo = parsedPseudo.replace(tag.value, `<span class="tag tag-${tag.class}">${tag.value}</span>`);
            }
        }
    }
    return parsedPseudo;
}

function parseSmallPseudo(text) {
    let parsedPseudo = text;
    let pseudoWithoutTags = text;
    for (let tag of TAGS) {
        if (parsedPseudo.endsWith(tag.value)) {
            parsedPseudo = parsedPseudo.replace(tag.value, `<span class="tag tag-${tag.class}">${tag.value}</span>`);
            pseudoWithoutTags = pseudoWithoutTags.replace(tag.value, "").trimEnd();
        }
    }
    return {fullPseudo: parsedPseudo, withoutTags: pseudoWithoutTags};
}

printMessage = function(data) {
    data.pseudo = parsePseudo(data.pseudo, data.isAdmin);
    data.message = parseMessage(data.message);
    if (data.pseudo === lastPseudo) {
        addToLastMessage(data.message);
    }
    else {
        document.getElementById("messagecontainer").innerHTML = '<div class="messages"><p>' + data.pseudo + '<br>' + data.message + '</p></div>' + document.getElementById("messagecontainer").innerHTML;
        lastPseudo = data.pseudo;
    }
}

origSendPseudo = sendPseudo;
sendPseudo = function() {
    config.pseudo = document.getElementById("pseudoInput").value;
    config.status = document.getElementById("statusInput").value;
    saveConfig();
    document.getElementById("pseudo").value = document.getElementById("pseudoInput").value + (document.getElementById("statusInput").value !== "" ? " | " + document.getElementById("statusInput").value : "");
    origSendPseudo();
}

const pseudoContainer = document.querySelector(".topbar > .flexrows:first-of-type");
pseudoContainer.className = "flexcolumns";
pseudoContainer.innerHTML = `
    <input type="hidden" id="pseudo">
    <div class="flexrows">
        <p>Pseudo: </p>
        <input type="text" placeholder="Pseudo" id="pseudoInput" value="${config.pseudo}" onchange="sendPseudo();">
    </div>
    <div class="flexrows">
        <p>Statut: </p>
        <input type="text" placeholder="Statut" id="statusInput" value="${config.status}" onchange="sendPseudo();">
    </div>
`;
document.getElementById("pseudo").value = config.pseudo + (config.status !== "" ? " | " + config.status : "");

let isPseudoListShown = false;

function showPseudoList(list) {
    isPseudoListShown = true;
    let pseudoList;
    if (document.querySelector(".pseudo-list")) {
        pseudoList = document.querySelector(".pseudo-list");
    }
    else {
        pseudoList = document.createElement("div");
        pseudoList.className = "pseudo-list";
        document.querySelector(".inputdiv").appendChild(pseudoList);
    }
    pseudoList.innerHTML = "";
    for (let pseudo of list) {
        const pseudodata = parseSmallPseudo(pseudo);
        const pseudoElement = document.createElement("div");
        pseudoElement.className = "pseudo-element";
        pseudoElement.innerHTML = pseudodata.fullPseudo;
        pseudoElement.setAttribute("data-pseudo", pseudodata.withoutTags)
        pseudoElement.onclick = function() {
            const text = document.getElementById("textinput").value;
            const lastWord = text.split(" ")[text.split(" ").length - 1];
            const newText = text.slice(0, text.length - lastWord.length) + "@" + pseudodata.withoutTags + " ";
            document.getElementById("textinput").value = newText;
            document.getElementById("textinput").focus();
            hidePseudoList();
        }
        pseudoElement.onmouseenter = function() {
            document.querySelector(".pseudo-list .selected").classList.remove("selected");
            pseudoElement.classList.add("selected");
        }
        pseudoList.appendChild(pseudoElement);
    }
    pseudoList.firstElementChild.classList.add("selected");
}

function hidePseudoList() {
    isPseudoListShown = false;
    if (document.querySelector(".pseudo-list")) {
        document.querySelector(".pseudo-list").remove();
    }
}

document.getElementById("textinput").addEventListener("keydown", function(e) {
    if (isPseudoListShown) {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            const selected = document.querySelector(".pseudo-list .selected");
            if (selected.previousElementSibling) {
                selected.previousElementSibling.classList.add("selected");
                selected.classList.remove("selected");
            }
        }
        else if (e.key === "ArrowDown") {
            e.preventDefault();
            const selected = document.querySelector(".pseudo-list .selected");
            if (selected.nextElementSibling) {
                selected.nextElementSibling.classList.add("selected");
                selected.classList.remove("selected");
            }
        }
        else if (e.key === "Enter") {
            e.preventDefault();
            const selected = document.querySelector(".pseudo-list .selected");
            const text = document.getElementById("textinput").value;
            const lastWord = text.split(" ")[text.split(" ").length - 1];
            const newText = text.slice(0, text.length - lastWord.length) + "@" + selected.getAttribute("data-pseudo") + " ";
            document.getElementById("textinput").value = newText;
            document.getElementById("textinput").focus();
            hidePseudoList();
        }
    }
});

document.getElementById("textinput").addEventListener("keyup", function(e) {
    if (isPseudoListShown && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter")) return;
    // log new textinput value to console after each input (for debugging)
    let text = e.target.value;
    const lastWord = text.split(" ")[text.split(" ").length - 1];
    if (lastWord[0] === "@" && lastWord.length > 1) {
        const pseudo = lastWord.slice(1);
        const pseudoList = config.known_users.map(u => u.pseudo);
        const pseudoListFiltered = pseudoList.filter(p => p.toLowerCase().startsWith(pseudo.toLowerCase()));
        if (pseudoListFiltered.length > 0) {
            showPseudoList(pseudoListFiltered);
        }
    }
    else {
        hidePseudoList();
    }
});

async function bdInit() {
    while (socket.readyState !== 1) {
        await new Promise(r => setTimeout(r, 100));
    }
    sendPseudo();
    printMessage({
        pseudo: "Better Discutaille SYSTÈME | Made with love by DocSystem",
        message: "Better Discutaille s'est chargé correctement !\nTu peux maintenant commencer à discutailler !",
        isAdmin: true
    });
}

bdInit();
