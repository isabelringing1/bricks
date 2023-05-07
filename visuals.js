var data;
var width;
var height;

var brick = "|___";
var ceil = "___";
var numRows = 25;
var numBricks;
var brickArr;
var bricksShown = 0;
var maxBricks = 500;
var rate = 40; //how many real bricks = 1 visual brick

function setupVisuals(){
    var text = document.createElement("span");
    document.getElementById("visuals").appendChild(text);
    text.style.position = 'absolute';
    text.innerHTML = brick;
    var brickWidth = text.clientWidth;
    numBricks = Math.ceil(window.innerWidth / brickWidth);
    document.getElementById("visuals").removeChild(text);
    brick += "|";

    generateEmpty();
    loadVisuals();
}

function loadVisuals(){
    var saveData = localStorage.getItem("visuals");
    if (saveData != null){
        saveData = JSON.parse(saveData);
        console.log(saveData)
        for (var i = 0; i < saveData.length; i++){
            for (var j = 0; j < saveData[i]; j++){
                placeBrick(j, i);
            }
        }
    }
}

function saveVisuals(){
    console.log(brickArr)
    localStorage.setItem("visuals", JSON.stringify(brickArr));
}

function clearVisuals(){
    localStorage.removeItem("visuals");
}

function generateEmpty(){
    document.getElementById("visuals").innerHTML = "";
    brickArr = new Array(numBricks).fill(0);
    for (var i = 0; i < numRows; i++){
        var row = document.createElement("span");
        row.className = "visual-row";
        row.id = "row-" + i;
        document.getElementById("visuals").appendChild(row);
        row.innerHTML = "".padStart(numBricks * 4);
    }
}

function updateVisuals(info){
    if (info.hasOwnProperty("bricks")){
        while (bricksShown < Math.floor(info["bricks"] / rate) && bricksShown <= maxBricks){
            var [r, c] = generateBrickCoords();
            placeBrick(r, c);
        }
    }
}

function simulate(){
    generateEmpty();
    var brickPos = [];
    for (var i = 0; i < maxBricks; i++){
        var [r, c] = generateBrickCoords();
        brickPos.push([r, c]);
        placeBrick(r, c);
    }
    console.log(brickArr);
}

function generateBrickCoords(){
    var probs = [];
    for (var i = 0; i < brickArr.length; i++){
        for (var j = 0; j < (brickArr[i] + 1); j++){
            probs.push(i);
        }
    }

    var index = Math.floor(Math.random() * probs.length);
    var row = spreadChance(probs[index]);
    while (brickArr[row] >= numRows - 1){
        index = Math.floor(Math.random() * probs.length);
        row = spreadChance(probs[index]);
    }
    
    return [brickArr[row], row];
}

function spreadChance(index){
    var num = Math.random();
    if (num < 0.15 && index - 1 >= 0){
        return index - 1;
    }
    else if (num > 0.85 && index + 1 < numBricks){
        return index + 1;
    }
    return index;
}

function placeBrick(row, col){
    var rowStr = $("#row-" + row)[0].innerHTML;
    $("#row-" + row)[0].innerHTML = rowStr.substring(0, col * 4) + brick + rowStr.substring(col * 4 + 5);

    var upperRowStr = $("#row-" + (row+1))[0].innerHTML;
    $("#row-" + (row+1))[0].innerHTML = upperRowStr.substring(0, col * 4 + 1) + ceil + upperRowStr.substring(col * 4 + 4);

    brickArr[col] += 1;
    bricksShown++;
}