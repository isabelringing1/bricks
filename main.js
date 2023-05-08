var landsMap;
var structuresMap;
var cardsMap;
var generatorsByNameMap;
var generatorsByLevelMap;
var titleMap;
var storyMap;
var currentLand;
var currentTitle = "";
var structureIndex = 0;
var messages = {};
var messagesMax = 20;
var messageHead = 0;
var messageTail = 0;
var digCount = 0;
var resolveFunc;
var inventorShown = false;
var brickmakerShown = false;

var messageMap = {
    "brick-plus": "Created a brick from the earth's clay.",
    "brick-plus-max": "You have depleted the land.",
    "brick-minus1": "Crumbled a brick back into earth.",
    "brick-minus2": "Crumbled a brick back into earth, again.",
    "brick-minus3": "Crumbled a brick back into earth. You're having fun despite yourself.",
    "brick-minus-max": "No bricks.",
    "brick-minus-max2": "No bricks. You dig into cracked earth.",
    "brick-minus-max3": "No bricks. You dig into cracked earth, and a beetle scurries out.",
    "hut-build": "Built a hut.",
    "brick-generate": "Hired a brickmaker.",
    "hut-build-err": "ERROR: Could not build a hut.",
    "village-build": "Built a village.",
    "village-build-err": "ERROR: Could not build a village.",
}

var updateSpeed = 50; //fifty times a second

$(document).ready(function() {
    $.getJSON('data.json', function(data, status, xhr){
        var hasSaveData = setMaps();
        if (!hasSaveData){
            for (var i = 0; i < data.lands.length; i++){
                landsMap.set(data.lands[i].level, data.lands[i]);
                for (var j = 0; j < data.lands[i].structures.length; j++){
                    structuresMap.set(data.lands[i].structures[j].name, data.lands[i].structures[j]);
                }
            }
            for (var i = 0; i < data.cards.length; i++){
                cardsMap.set(data.cards[i].id, data.cards[i]);
            }
    
            for (var i = 0; i < data.story.length; i++){
                storyMap.set(data.story[i].condition, data.story[i]);
            }

            for (var i = 0; i < data.titles.length; i++){
                titleMap.set(data.titles[i].condition, data.titles[i].title);
            }
        }
        
        unlockLand(0, !hasSaveData);
        generateAllCards();
        updateCards();
        updateTitle();
        setupVisuals();

        $(".plus").click(onPlusClicked);
        $(".minus").click(onMinusClicked);

        $("#title").click(function(){
            //simulate();
        });

        $("#modal-button").click(() => {
            resolveFunc();
        });

        $("#save-button").click(() => {
            saveData();
            $("#save-tag").addClass("show");
            setTimeout(() => { $("#save-tag").removeClass("show"); }, 300);
        });

        $("#reset-button").click(() => {
            clearData();
            $("#reset-tag").addClass("show");
            setTimeout(() => { $("#reset-tag").removeClass("show"); location.reload(); }, 300);
        });

        setInterval(update, 1000 / updateSpeed);
    });    
});

// Main update function 
function update(){
    generatorsByNameMap.forEach(function(generator, structureName) {
        if (generator.increment > 0){
            incrementStructure(generator, structureName, (generator.increment * gen.multiplier) / updateSpeed);
        }
    });
}

function incrementStructure(generator, structureName, amount, isCheat = false){
    generator.value += amount;
    generator.total += amount;
    if (generator.unlocked){
        setCtr(structureName, generator.value);
    }
    
    // if the structure is level 0, we know we must deduct the land counter too
    if (generator.level == 0){
        var landGen = generatorsByNameMap.get("land" + generator.landLevel);
        if (landGen.value == 0){
            return false;
        }
        landGen.value -= amount;
        setCtr("land", Math.floor(landGen.value));
        updateVisuals({bricks: generator.value});
    }
    else { // otherwise, we deduct the cost from the resource below
        var cost = cardsMap.get("build-" + structureName).cost;
        costGen = generatorsByNameMap.get(cost.currency);
        if (costGen.value - cost.currrent < 0){
            return false;
        }
        costGen.value -= cost.current;
        cost.current *= cost.growth;
        setCtr(costGen.name, Math.ceil(costGen.value));
        if (generator.unlocked){
            updateCost(generator.name, cost.current);
        }
    }
    
    if (!isCheat){
        updateStory(updateCards);
        updateTitle();
    }
    else{
        updateCards();
        updateTitle();
    }
    return true;
}

function decrementStructure(generator, structureName, amount){
    if (generator.value - amount < 0){
        return false;
    }

    generator.value -= amount;
    generator.total -= amount;
    generator.decremented += amount;
    if (generator.level > 0) { // Must give to structure beneath it
        var lowerLandGen = generatorsByLevelMap.get("land" + generator.landLevel + "." +  (generator.level - 1));
        lowerLandGen.value += generator.cost;
        setCtr(lowerLandGen.name, lowerLandGen.value);
    }
    else { // add to land
        var landGen = generatorsByNameMap.get("land" + generator.landLevel);
        landGen.value += amount;
        setCtr("land", Math.ceil(landGen.value));
    }
    setCtr(structureName, generator.value);
    updateStory(updateCards);
    return true;
}

function unlockLand(landLevel, newData){
    var land = landsMap.get(landLevel + "");
    if (land != undefined){
        if (newData){
            generatorsByNameMap.set("land" + landLevel, {value: land.initialLand, increment: 0});
            generatorsByLevelMap.set("land" + landLevel, {value: land.initialLand, increment: 0});
            // Add all new generators to map
            for (var i = 0; i < land.structures.length; i++){
                var value = { 
                    value: 0, 
                    total: 0,
                    increment: 0, 
                    decremented: 0,
                    multiplier: 1,
                    landLevel: landLevel, 
                    level: land.structures[i].level, 
                    name: land.structures[i].name, 
                    unlocked: false };
                generatorsByNameMap.set(land.structures[i].name, value);
                generatorsByLevelMap.set("land" + landLevel + "." + land.structures[i].level, value);
            }
        }
        else{
            //for (var i = 0; i < land.structures)
        }
        currentLand = land;
        structureIndex = 0;
        var landGen = generatorsByNameMap.get("land" + landLevel);
        setCtr("land", landGen.value);
        unlockNextStructure();
    }
    else{
        console.log("Cannot get land with level " + landLevel);
    }
}

function unlockNextStructure(){
    if (currentLand != undefined && structureIndex < currentLand.structures.length){
        var newStructure = currentLand.structures[structureIndex];
        var gen = generatorsByNameMap.get(newStructure.name);
        console.log("Unlocking structure " + newStructure.name);
        var dupe = $("#structure-template")[0].content.cloneNode(true);
        var row = dupe.querySelector(".row");

        var names = dupe.querySelectorAll(".structure-name");
        for (var i = 0; i < names.length; i++){
            var name = newStructure.name;
            if (names[i].classList.contains("capital")){
                name = name.charAt(0).toUpperCase() + name.slice(1);
            }
            names[i].innerHTML = name;
        }

        if (newStructure.level == 0){
            dupe.querySelector(".sub.row.cost").style = "display:none";
            dupe.querySelector(".button.small.minus").id = newStructure.name + "-minus";
            dupe.querySelector(".button.small.plus").id = newStructure.name + "-plus";
        }
        else{
            var cost = cardsMap.get("build-" + gen.name).cost;
            dupe.querySelector(".cost-name").innerHTML = cost.currency;
            dupe.querySelector(".button-space").style.display = "none";
            dupe.querySelector(".cost-display").id = newStructure.name + "-cost-display";
            dupe.querySelector(".cost-display").innerHTML =  Math.ceil(cost.current);
        }

        row.id = newStructure.name + "-row";
        
        dupe.querySelector(".ctr").id = newStructure.name + "-ctr";
        dupe.querySelector(".ctr").innerHTML = gen.value;
        dupe.querySelector(".rate.display").id = newStructure.name + "-rate";
        if (gen.increment > 0){
            dupe.querySelector(".sub.row.rate").style.display = "block";
            dupe.querySelector(".rate.display").innerHTML = gen.increment;
        }

        var gen = generatorsByNameMap.get(newStructure.name);
        gen.unlocked = true;

        structureIndex++;
        $("#materials")[0].appendChild(dupe);
        return true;
    }
    return false;
}


function onPlusClicked(event){
    var structureName = event.target.id.replace('-plus', '');
    var generator = generatorsByNameMap.get(structureName);

    if (generator != undefined){
        if (incrementStructure(generator, structureName, 1)){
            postMessage(messageMap[structureName + "-plus"]);
        }
        else{
            postMessage(messageMap[structureName + "-plus-max"]);
        }
    }
}

function onMinusClicked(event){
    var structureName = event.target.id.replace('-minus', '');
    var generator = generatorsByNameMap.get(structureName);
    if (generator != undefined){
        if (decrementStructure(generator, structureName, 1)){
            if (structureName == "brick"){
                if (generator.decremented <= 2){
                    postMessage(messageMap[structureName + "-minus1"]);
                }
                else if (generator.decremented <= 10){
                    postMessage(messageMap[structureName + "-minus2"]);
                }
                else{
                    postMessage(messageMap[structureName + "-minus3"]);
                }
            }
        }
        else{
            digCount++;
            if (digCount <= 2){
                postMessage(messageMap[structureName + "-minus-max"]);
            }
            else{
                if (Math.random() > 0.8){
                    postMessage(messageMap[structureName + "-minus-max2"]);
                }
                else{
                    postMessage(messageMap[structureName + "-minus-max3"]);
                }
                
            }            
        }
    }
}

function setCtr(structureName, amount, decimals = 0){
    amount = parseFloat(amount);
    var ctr = $("#" + structureName + "-ctr")[0];
    ctr.innerHTML = parseFloat(amount.toFixed(decimals)).toLocaleString("en-US");
}

function updateCost(name, current){
    $("#" + name + "-cost-display")[0].innerHTML =  Math.ceil(current);
}

function postMessage(msg){
    var div = document.createElement("div");
    div.className = "message";
    div.id = "message-" + messageTail;
    div.innerHTML = msg;
    $("#messages").append(div);
    div.className += " shown";

    messages[messageTail] = div;
    messageTail++;
    if (messageTail >= messagesMax){
        delete messages[messageHead];
        messageHead++;
    }

    messages[messageTail - 1].style.background = "rgb(255, 255, 255)";
    var opacity = 0.9;
    for (var i = messageTail-2; i >= messageHead; i--){
        messages[i].style.color = "rgb(0, 0, 0, " + opacity + ")";
        messages[i].style.background = "rgb(255, 255, 255, " + (opacity*1.5) + ")";
        opacity -= 0.05;
    }
}

function updateCards(){
    for (let [id, card] of cardsMap){
        var description = card.description.replace("$COST", Math.ceil(card.cost.current));
        if (card.description.includes("$MULTIPLIER")){
            var gen = generatorsByNameMap.get(card.structure);
            description = description.replace("$MULTIPLIER",  gen.multiplier);
        }
        if (card.description.includes("$BRICKMAKERS")){
            var gen = generatorsByNameMap.get(card.structure);
            description = description.replace("$BRICKMAKERS", Math.ceil(gen.increment));
        }
        $("#" + id + " .card-body")[0].innerHTML = description;

        if (canFulfill(card)){
            $("#" + id)[0].style.display = "flex";
            if ($("#" + id).hasClass("preview")){
                $("#" + id).removeClass("preview");
            }
            if (!$("#" + id).hasClass("active")){
                $("#" + id).addClass("active");
            }
        }
        // if card is in preview window or it has already been shown 
        else if (canShowPreview(card, id)){
            $("#" + id)[0].style.display = "flex";
            if (!$("#" + id).hasClass("preview")){
                $("#" + id).addClass("preview");
            }
            if ($("#" + id).hasClass("active")){
                $("#" + id).removeClass("active");
            }
        }
        else{
            $("#" + id)[0].style.display = "none";
        }
    }
}

function canFulfill(card){
    if (card.numBought > card.limit || (card.numBought > 0 && !card.repeatable)){
        return false;
    }

    if (card.hasOwnProperty("show_condition")){
        if (card.show_condition == "inventorShown" && !inventorShown){
            return false;
        }
    }

    // TODO: don't hard code land number
    var name = card.cost.currency == "land" ? "land0" : card.cost.currency;
    gen = generatorsByNameMap.get(name);
    return Math.ceil(gen.value) - Math.ceil(card.cost.current) >= 0;
}

function canShowPreview(card, id){
    if (card.numBought > card.limit || (card.numBought > 0 && !card.repeatable)){
        return false;
    }
    // if it's already showing and we can't hide it
    if (($("#" + id)[0].style.display == "flex") && !card.hideable){
        return true;
    }

    if (card.hasOwnProperty("show_condition")){
        if (card.show_condition == "inventorShown"){
            return inventorShown;
        }
    }

    // otherwise we compare it against the card's cost
    var name = card.cost.currency == "land" ? "land0" : card.cost.currency;
    gen = generatorsByNameMap.get(name);
    return gen.value - card.cost.current >= -card.preview;
}

function generateAllCards(){
    for (let [id, newCard] of cardsMap){
        var dupe = $("#card-template")[0].content.cloneNode(true);
        var card = dupe.querySelector(".card");
        dupe.querySelector(".card-title").innerHTML = newCard.title;
        dupe.querySelector(".card-body").innerHTML = newCard.description.replace("$COST", Math.ceil(newCard.cost.current));
        card.id = id;
        card.style.display = "none";
        newCard.numBought = 0;
        newCard.preview = parseInt(newCard.preview);
        newCard.limit = parseInt(newCard.limit)
        newCard.repeatable = (newCard.repeatable === 'true');
        newCard.hideable = (newCard.hideable == 'true')
        newCard.cost.current = parseInt(newCard.cost.initial_cost);

        dupe.querySelector(".card").addEventListener("click", (e) => { onCardClick(e)});
        $("#cards")[0].appendChild(dupe);
    }
}

function onCardClick(e){
    var card = cardsMap.get(e.target.closest(".card").id);
    if (card != undefined && canFulfill(card)){
        card.numBought++;
        if (card.action == "generate"){
            var generator = generatorsByNameMap.get(card.structure);
            var costGen = generatorsByNameMap.get(card.cost.currency);
            generator.increment += 1;
            $("#" + card.structure + "-rate")[0].closest(".sub.row.rate") .style.display = "block";
            $("#" + card.structure + "-rate")[0].innerHTML = (generator.multiplier * generator.increment).toFixed(2);
            costGen.value -= card.cost.current;
            card.cost.current *= card.cost.growth;
            postMessage(messageMap[card.structure+"-generate"]);
        }
        else if (card.action == "build"){
            var generator = generatorsByNameMap.get(card.structure);
           if (incrementStructure(generator, card.structure, 1)){
                postMessage(messageMap[card.structure+"-build"]);
                if (!generator.unlocked){
                    unlockNextStructure();
                }
           }
           else{
                postMessage(messageMap[card.structure+"-build-err"]);
           }
        }
        else if (card.action == "multiply"){
            var generator = generatorsByNameMap.get(card.structure);
            console.log(generator)
            generator.multiplier *= parseFloat(card.amount);
            var costGen = generatorsByNameMap.get(card.cost.currency);
            costGen.value -= card.cost.current;
            $("#" + card.structure + "-rate")[0].innerHTML = (generator.multiplier * generator.increment).toFixed(2);
        }
    }
    updateStory(updateCards);
}

function showModal(title, body, button){
    if (title != null){
        $("#modal-title")[0].innerHTML = title;
    }
    else{
        $("#modal-title")[0].innerHTML = "";
    }
    if (body != null){
        $("#modal-body")[0].innerHTML = body;
    }
    else{
        $("#modal-body")[0].innerHTML = "";
    }
    if (button != null){
        $("#modal-button")[0].innerHTML = button;
    }
    else{
        $("#modal-button")[0].innerHTML = "";
    }
    $("#modal-container")[0].style.display = "flex";
}

function hideModal(){
    $("#modal-container")[0].style.display = "none";
}

function updateStory(callback = null){
    var storyShown = false;
    for (let [condition, story] of storyMap){
        let conditionMet = true;
        if (condition.hasOwnProperty("structures")){
            for (var i = 0; i < condition.structures.length; i++){
                var gen = generatorsByNameMap.get(condition.structures[i].structure);
                var val = condition.structures[i].hasOwnProperty("use_total") && condition.structures[i].use_total == "false" ? gen.value : gen.total;
                if (val < parseInt(condition.structures[i].amount)){
                    conditionMet = false;
                    break;
                }
            }
        }
        else if (condition.hasOwnProperty("cardId")){
            var card = cardsMap.get(condition.cardId);
            if (card == null || card.numBought != condition.amount){
                conditionMet = false;
            }
        }
        else if (condition.hasOwnProperty("decrement")){
            if (condition.structure != null){
                var gen = generatorsByNameMap.get(condition.structure);
                if (gen.decremented < parseInt(condition.decrement) || !brickmakerShown){
                    conditionMet = false;
                }
            }
        }
        
        if (conditionMet){
            storyShown = true;
            showTextAsync(story.text, callback);
            if (story.repeatable == "false"){
                storyMap.delete(condition);
            }
            if (story.hasOwnProperty("condition_set")){
                if (story.condition_set == "inventorShown"){
                    inventorShown = true;
                }
                if (story.condition_set == "brickmakerShown"){
                    brickmakerShown = true;
                }
            }
            break;
        }
    }

    if (!storyShown && callback != null){
        callback();
    }
}

async function showTextAsync(text, callback){
    for (var i = 0; i < text.length; i++){
        showModal(text[i].title, text[i].body, text[i].button);
        var promise = new Promise((resolve) => { resolveFunc = resolve });
        await promise.then(() => { 
            if (i == text.length - 1 && callback != null){
                callback();
            }
         });
    }
    hideModal();
}

function updateTitle(){
    var mostUpdatedTitle = "";
    for (let [condition, title] of titleMap){
        var gen = generatorsByNameMap.get(condition.structure);
        if (gen.value >= condition.amount){
            mostUpdatedTitle = title;
        }
    }
    if (mostUpdatedTitle != currentTitle){
        currentTitle = mostUpdatedTitle;
        $("#title")[0].innerHTML = currentTitle;
        document.title = currentTitle;
    }
}

// Saving / Loading

function setMaps(){
    var saveData = localStorage.getItem("data");
    if (saveData != null){
        try{
            saveData = JSON.parse(saveData);
            console.log(saveData)
            landsMap = new Map(saveData.landsMap);
            structuresMap = new Map(saveData.structuresMap);
            generatorsByNameMap = new Map(saveData.generatorsByNameMap);
            generatorsByLevelMap = new Map(saveData.generatorsByLevelMap);
            storyMap = new Map(saveData.storyMap);
            cardsMap = new Map(saveData.cardsMap);
            titleMap = new Map(saveData.titleMap);
            return true;
        }
        catch (e) {
            console.log(e)
        }
    }
    landsMap = new Map();
    structuresMap = new Map();
    cardsMap = new Map();
    generatorsByNameMap = new Map();
    generatorsByLevelMap = new Map();
    storyMap = new Map();
    titleMap = new Map();
    return false;
}

function saveData(){
    saveVisuals();
    var data = {
        generatorsByNameMap: [...generatorsByNameMap],
        generatorsByLevelMap: [...generatorsByLevelMap],
        storyMap: [...storyMap],
        cardsMap: [...cardsMap],
        structuresMap: [...structuresMap],
        landsMap: [...landsMap],
        titleMap: [...titleMap],
    }
    localStorage.setItem("data", JSON.stringify(data));
}

function clearData(){
    clearVisuals();
    localStorage.removeItem("data");
}

// CHEATS

function useBrick(amt){
    incrementStructure(generatorsByNameMap.get("brick"), "brick", amt, true);
}

function useHut(amt){
    var card = cardsMap.get("build-hut");
    for (var i = 0; i < amt; i++){
        incrementStructure(generatorsByNameMap.get("hut"), "hut", 1, true);
    }
}

function useVillage(amt){
    incrementStructure(generatorsByNameMap.get("village"), "village", amt, true);
}

function setBrickRate(rate){
    generatorsByNameMap.get("brick").increment = rate;
}

function setBrick(amt){
    generatorsByNameMap.get("brick").value = amt;
}

function setHut(amt){
    generatorsByNameMap.get("hut").value = amt;
}

function setVillage(){
    generatorsByNameMap.get("village").value = amt;
}