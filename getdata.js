
        // Критерий за оптималност (Cj - Zj):
        //   MAX: оптимум когато всички Cj-Zj <= 0
        //   MIN: оптимум когато всички Cj-Zj >= 0
var dataLHS = [[]];  // коефициентни редове от потребителския вход
var NOSOLUTION = false;
let SOLVABLE = false;  // дали задачата има допустимо решение
let SOLVED = false;    // дали алгоритъмът е завършил

// Извиква се при промяна на текстово поле; парсва реда и обновява таблицата с коефициенти.
function getRowData(tindex){
    let z = document.getElementsByName("lhs")[tindex].value;
    if(!validateLHS(z) || z == "") return;

    dataLHS[tindex] = createRow(extractNumbers(z));

    addZeroes(dataLHS);     // изравнява дължините на редовете с нули
    createXtable(dataLHS);  // визуализира коефициентната матрица
}

// Преобразува задачата в канонична форма чрез добавяне на slack/surplus/изкуствени променливи:
//   <= : добавя slack (+xN)
//   >= : добавя surplus (-xN) и изкуствена (+xN+1) за намиране на начално допустимо решение
function makeCanonical(){

    let eq_types = document.getElementsByName("eq_type");
    let lhs = document.getElementsByName("lhs");
    let textTable = [];
    let canonicalTable = [[]];
    let lastXindex = 0;

    for(let i=0;i<lhs.length;i++){
        textTable[i] = lhs[i].value;
    }

    canonicalTable = extractTable(textTable);
    lastXindex = canonicalTable[0].length;

    for(let i=0;i<eq_types.length;i++){
        switch(eq_types[i].value){
        case "less_equal":
            lastXindex++;
            textTable[i+1] = textTable[i+1] + " + x" + lastXindex;
            break;
        case "equal_greater":
            // surplus променлива след това изкуствена, за да се осигури начална базисна точка
            lastXindex++;
            textTable[i+1] = textTable[i+1] + " - x" + lastXindex;
            lastXindex++;
            textTable[i+1] = textTable[i+1] + " + x" + lastXindex;
            break;
        }
    }

    canonicalTable = extractTable(textTable);
    loadRHSvalues(canonicalTable);

    printCanonical(textTable, lastXindex);
    printTermsTable(canonicalTable);

    return canonicalTable;
}

// Simplex изисква неотрицателни RHS стойности; ако b < 0, умножаваме реда по -1.
function checkSigns(table){
    if(table.length > 1)
        for(let i=1;i<table.length;i++){
            if(table[i][table[i].length - 1] < 0){
                for(let j=0;j<table[i].length;j++)
                    table[i][j] *= -1;
            }
        }
    return table;
}

// Основна функция: изгражда начална симплекс таблица и итерира до оптималност или недопустимост.
function startSimplex(){

    let mainTable = checkSigns(makeCanonical());
    // Конвертира всички стойности към числа, тъй като extractNumbers връща стрингове.
    for(let i=0;i<mainTable.length;i++)
        for(let j=0;j<mainTable[i].length;j++)
            mainTable[i][j] = Number(mainTable[i][j]);

    let simplexTable = [[]];
    let slackArray = [];
    let rows = mainTable.length;
    let columns = mainTable[0].length;
    let lastIndex = columns - 1;
    let Z = [];
    let zj = [];
    let Cj_Zj = [];
    

    let Bj = (()=>{
        let b = [];
        for(let ri=1;ri<rows;ri++){
            b.push(mainTable[ri][lastIndex]);
        }
        return b;
    })();

    Z = mainTable[0];

    function setRHS(){
        let b = [];
        for(let ri=1;ri<mainTable.length;ri++){
            b.push(mainTable[ri][mainTable[0].length-1]);
        }
        return b;
    }
    function createElement(r = 0,c = 0,v = 0){
        return{
            row: r,
            column: c,
            value: v,
            ratio: 0,
            name: 'x' + (c+1)
        }
    }   
    function loadSlacks(){
        let lastIndex = mainTable[0].length - 1;
        let slackCounter = (() =>{
            let counter = 0;
            let index = lastIndex - 1;//последния коефициент на х
            while(mainTable[0][index] == 0){
                counter++;
                index--;
            }
            return counter;
        })();
        let SA = [];//SA - slack array

        if(slackCounter>0)
            for(let ri=1;ri<mainTable.length;ri++){
                for(let ci=lastIndex - slackCounter;ci<lastIndex;ci++){
                    if(mainTable[ri][ci]<0){
                        let ABV; //another basic variable
                        ABV = findAnotherBV(ri);
                        if( ABV!= -1){
                            //SA[ri-1] = ABV;
                            terminateArtificial(mainTable,ci+1);
                            //divideTargetRow(mainTable,ABV.row,ABV.value);
                            //makeBasisVector(SA[ri-1]);
                            break;
                        }
                        else
                        {
                            SA[ri-1] = createElement(ri,ci+1,mainTable[ri][ci+1])
                            SA[ri-1].value = 1000000;
                            break;
                        }        
                    }
                    if(mainTable[ri][ci]>0){
                        SA[ri-1] = createElement(ri,ci,mainTable[ri][ci])
                        break;
                    }      
                }
            }
        
        for(let r=1;r<mainTable.length;r++){
            if(SA[r-1] == undefined){
                SA[r-1] = findAnotherBV(r);
                console.log('Loading BV from pure equations: ' + SA[r-1].value);
                if(SA[r-1] != undefined){
                    //SA[r-1] = divideTargetRow(mainTable,SA[r-1].row,SA[r-1].value);
                    makeBasisVector(SA[r-1]);
                }
            }
        }
        return SA;
    }
    // Премахва изкуствена променлива чиято slack колона е отрицателна (вече е извън базата).
    function terminateArtificial(T,EC){
        for(let ri=0;ri<T.length;ri++){
            T[ri].splice(EC,1);
        }
        rows = T.length;
        columns = T[0].length;
        lastIndex = columns - 1;
        Z = T[0];
    }
    function findAnotherBV(targetRow){
        let haveMin = false;
        let colStop = mainTable[0].length - 1//lastIndex - slackCounter;
        let cCounter = 0;
        let BV
        
        while(haveMin == false && cCounter < colStop){
            BV = calculateRatio(mainTable,cCounter);
            if(BV == undefined){
                return -1
            }
                
            if(BV.row == targetRow){
                haveMin = true;
                console.log('Found another basic variable: [' + BV.row + ',' + BV.column + ']');
            } 
            cCounter++;
        }
        return BV;
    }
    function divideTargetRow(table,row,value){
        for(let i=0;i<table[0].length;i++)
            table[row][i] = (table[row][i]/value).toFixed(2);
        return table;
    }
    function calculateNewElement(oldValue,keyColumnSameRow,keyRowSameColumn){
        return (oldValue - (keyColumnSameRow*keyRowSameColumn)).toFixed(2);
    }
    function selectBVColumn(){
        let LPP = document.getElementsByName("targetf");
        let ZIndex = undefined;                
        let LPPTargetIndex;
        if(LPP[0] != undefined){
            switch(LPP[0].value){
                case "min":
                    console.log('Working on LPP: MINIMUM');
                    LPPTargetIndex = Math.min(...Cj_Zj);
                    if(LPPTargetIndex<0){
                        for(let i=0;i<Cj_Zj.length;i++)
                            if(LPPTargetIndex == Cj_Zj[i])
                                ZIndex = i; 
                    } 
                break;
                case "max": 
                    console.log('Working on LPP: MAXIMUM');
                    LPPTargetIndex = Math.max(...Cj_Zj);
                    if(LPPTargetIndex>0){
                        for(let i=0;i<Cj_Zj.length;i++)
                            if(LPPTargetIndex == Cj_Zj[i])
                                ZIndex = i;
                    }
                break;
            }
        }
        return ZIndex;
    }
    // Минимално съотношение (b/aij) за избор на излизащ ред от базата (правило на Bland).
    // Пропуска нулеви и отрицателни елементи в pivot колоната.
    function calculateRatio(data2D,colindex){
        let minRatio;
        let size_c = data2D[0].length;
        let ratios = [];
        for(let i=1;i<data2D.length;i++){
            if(data2D[i][colindex] == 0 || data2D[i][colindex] < 0)
                continue;
            console.log('Ratio: ' + data2D[i][size_c-1] + '/' + data2D[i][colindex]);
            ratios.push(createElement(i,colindex,data2D[i][colindex]))
            ratios[ratios.length-1].ratio = data2D[i][size_c-1]/data2D[i][colindex];
        }
        if(ratios[0] != undefined)
            minRatio = ratios[0];
        for(let i=1;i<ratios.length;i++){
            if(minRatio.ratio > ratios[i].ratio)
                minRatio = ratios[i];
        }
        return minRatio;
    }      
    // Pivot операция: нормализира pivot реда и елиминира pivot колоната от всички останали редове.
    function makeBasisVector(targetElement){
        let varioRow;
        divideTargetRow(mainTable,targetElement.row,targetElement.value);
        targetElement.value = 1;

        for(let ri=1;ri<mainTable.length;ri++){
            varioRow = [];
            if(ri == targetElement.row)
                continue;
            for(let ci=0;ci<mainTable[0].length;ci++){
                varioRow[ci] = calculateNewElement(mainTable[ri][ci],mainTable[ri][targetElement.column],mainTable[targetElement.row][ci]);
            }
            console.log('Vario start')
            console.log(varioRow);
            console.log('Vario stop');
            mainTable[ri] = varioRow;
        }
    }
    function leadInABV(){//lead in another basic variable
        let selectedColumn = selectBVColumn();
        console.log('BVC index: ' + selectedColumn);
        let targetElement = undefined;
        if(selectedColumn != undefined){
            targetElement = calculateRatio(mainTable,selectedColumn);
            console.log('Leading in new BASIC variable: ' + targetElement);
            if(targetElement!=undefined){
                makeBasisVector(targetElement);
                for(let i=0;i<slackArray.length;i++)
                    if(slackArray[i].row == targetElement.row)
                        slackArray[i] = targetElement;     
            }         
        } 
        return targetElement;
    }
    function calculateZj(){
        let zSum = [];
        for(let ci = 0;ci<lastIndex;ci++)
        {
            zSum[ci] = 0;
            for(let si=0;si<slackArray.length;si++){
                zSum[ci] += Number(mainTable[0][slackArray[si].column]*mainTable[slackArray[si].row][ci])
            }
        }
        return zSum;   
    }
    function calculateZ(){
        let ZinStep = 0;//целевата в тази стъпка на изпълнение
        Bj = setRHS();
        for(let bi=0;bi<Bj.length;bi++){
            ZinStep += mainTable[0][slackArray[bi].column]*Bj[bi];//mainTable[slackArray[bi].row][bi]
        }
        return ZinStep;
    }
    function calculateCj_Zj(){
        let cz = [];
        for(let i=0;i<lastIndex;i++)
            cz[i] = mainTable[0][i] - zj[i];
        return cz;
    }
    function createSTable(){

        simplexTable=[[]];
        simplexTable[0].push("Zкоеф:");
        
        for(let i=0;i<mainTable[0].length;i++)
            simplexTable[0].push(mainTable[0][i]);
        
        let r1 = ["База"];
        simplexTable.push(r1);
        for(let i=0;i<columns;i++){
            if(i == columns - 1)
                simplexTable[1].push('b')
            else
                simplexTable[1].push('x' + (i+1));
        }
         
        let r2 = ["Z:Бз.Коеф","БзПром."];
        simplexTable.push(r2);

        for(let i=0;i<slackArray.length;i++){ 
            let rx = [];
            rx.push(mainTable[0][slackArray[i].column]);//load data 0
            rx.push(slackArray[i].name);//load data 1
            for(let j=0;j<mainTable[slackArray[i].row].length;j++)
                rx.push(mainTable[i+1][j]);
            simplexTable.push(rx);
            //console.log(rx);
        }
        
        let r = ['делта Zj:'];
        for(let i=0;i<zj.length;i++)
            r.push(Number(zj[i]).toFixed(2));//////////////////////////////
        r.push(calculateZ());//добавяне на калкулираната стойност на целевата ф-я
        simplexTable.push(r);

        r = [];
        r = ['Cj - Zj:'];
        for(let i=0;i<Cj_Zj.length;i++)
            r.push(Cj_Zj[i]);
        simplexTable.push(r);
    }
    
    slackArray = loadSlacks();
    zj = calculateZj()
    ZValue = calculateZ();
    Cj_Zj = calculateCj_Zj();
    createSTable();
    printSimplexTable(simplexTable,0);
    
    let stepcounter = 0;
    while(leadInABV()!=undefined){
        zj = [];
        ZValue = 0;
        Cj_Zj = [];
        stepcounter++
        zj = calculateZj()
        ZValue = calculateZ();
        Cj_Zj = calculateCj_Zj();
        createSTable();
        printSimplexTable(simplexTable,stepcounter);
    }

    if(selectBVColumn() == undefined){
        SOLVED = true;
        SOLVABLE = true
    }
    else{
        SOLVED = true;
        SOLVABLE = false;
    }
    printSimplexTable(simplexTable,-1);


}

function printSimplexTable(table,stage){
    let body = document.getElementById('simplexTable');
    let tbl = document.createElement('table');
    tbl.setAttribute('id','stdata');
    tbl.style.width = '80px';
    tbl.style.height = '50px';
    tbl.setAttribute('border', '1');
    tbl.style.borderCollapse = 'collapse';
    
    let tbdy = document.createElement('tbody');
    let tr;
    for(let i=0; i<table.length;i++){
        tr = document.createElement('tr');
        for (let j = 0; j < table[i].length; j++) {
            let td = document.createElement('td');
            if((i==0 && j==0) || 
               (i==1 && j==0)||
               (i==table.length-2 && j==0) || 
               (i==table.length-1 && j==0))
                td.colSpan = 2;
            if((i>2 && i <table.length - 2) && j == 0)
                td.style.backgroundColor = "#6CC";
            if((i>2 && i <table.length - 2) && j == 1)
                td.style.backgroundColor = "yellow";
            td.textContent = table[i][j];
            td.appendChild(document.createTextNode('\u0020'))
            tr.appendChild(td)
        }
    tbdy.appendChild(tr);
    }
    tbl.appendChild(tbdy);
    let space = document.createElement('p');
    space.style.backgroundColor = "yellow";
    space.style.width = "200px";
    let msg = '';

    if(stage == -1){
        if(SOLVED && SOLVABLE)
            msg = 'LPP is SOLVED';
        else if(SOLVED && !SOLVABLE)
            msg = 'LPP NOT SOLVABLE!'; 
    }
    else{
        msg = 'Симплекс фаза: [' + stage + '].';
    }
    
    
    console.log('SOLVED: ' + SOLVED + ' SOLVABLE: ' + SOLVABLE);

    let spacetext = document.createTextNode(msg);
    space.appendChild(spacetext);
    body.appendChild(space);
    body.appendChild(tbl)
}
//извеждане на каноничната форма на заданието
function printCanonical(textT,lastX){
    let cantext = document.getElementById("canonical");
    let result = document.getElementsByName('result');
    let targetF = document.getElementsByName("targetf");
    let term;
    let text = textT;
    let lastXrow = text[text.length-1];
    //lastX = lastXrow[lastXrow.length -1]
    cantext.style.color = "yellow";
    cantext.textContent = "Канонична форма:";
    if(targetF[0] != undefined){
        text[0] = 'Да се намери (' + targetF[0].value + ') : ' + 
                    text[0] + ' . При условия:';
    }

    if(textT.length>=2)
        for(let i=1;i<text.length;i++){
            text[i] += " = ";
            text[i] += result[i-1].value;
            //console.log(text[i]);
        }
    
    for(let i=0;i<text.length;i++){
        //console.log(text);
        lineFeed = document.createElement("br");
        cantext.appendChild(lineFeed);
        term = document.createTextNode(text[i]);
        cantext.appendChild(term);
    }

    lineFeed = document.createElement("br");
    cantext.appendChild(lineFeed);
    lastX = 'x1..x' + lastX + ' >= 0';
    term = document.createTextNode(lastX);
    cantext.appendChild(term);
}
function extractTable(text){
    var table = [[]];
    for(let i=0;i<text.length;i++){
        table[i] = createRow(extractNumbers(text[i]));
        addZeroes(table);
    }
    return table;
}
function createXtable(table) {
    let oldtable = document.getElementById('tdata');
    
    if(oldtable != null){
        oldtable.parentElement.removeChild(oldtable);
    }

    let body = document.getElementById('tabledata');
    let tbl = document.createElement('table');
    tbl.setAttribute('id','tdata');
    tbl.style.width = '60px';
    tbl.style.height = '50px';
    tbl.setAttribute('border', '1');
    tbl.style.borderCollapse = 'collapse';
    
    let tbdy = document.createElement('tbody');
    let tr;
    for(let i=0; i<table.length;i++){
        if(i == 0){
            //console.log("Creating Header!");
            tr = document.createElement('tr');
            for (let j = 0; j < table[i].length; j++){
                let td = document.createElement('td');
                td.textContent = 'x' + (j+1);
                td.appendChild(document.createTextNode('\u0020'));
                tr.appendChild(td);
            }
            tbdy.appendChild(tr);  
        }
        tr = document.createElement('tr');
        for (let j = 0; j < table[i].length; j++) {
            let td = document.createElement('td');
            td.textContent = table[i][j];
            td.appendChild(document.createTextNode('\u0020'))
            tr.appendChild(td)
        }
    tbdy.appendChild(tr);
    }
    tbl.appendChild(tbdy);
    body.appendChild(tbl)
}
function loadRHSvalues(table){
    let rhs = document.getElementsByName("result");
    if(rhs[0] == undefined) return;
    
    for(let i=0;i<table.length;i++){
        if(i == 0)
            {
                //console.log('Loading RHS with: 0')
                table[i].push(0);
                //console.log(table[i][table[i].length-1]);
            }
            
        else{
            if(rhs[i - 1].value == ''){
                //console.log('Loading RHS with: 0' + rhs[i-1].value);
                table[i].push(0);
            }
            else{
                //console.log('Loading RHS with: ' + rhs[i-1].value);
                table[i].push(Number(rhs[i-1].value));
            }
                
        } 
    }
}
function printTermsTable(table){

    let oldtable = document.getElementById('tdata');
    
    if(oldtable != null){
        oldtable.parentElement.removeChild(oldtable);
    }

    //loadRHSvalues(table);
    //console.log(table);

    let body = document.getElementById('tabledata');
    let tbl = document.createElement('table');
    tbl.setAttribute('id','tdata');
    tbl.style.width = '60px';
    tbl.style.height = '50px';
    tbl.setAttribute('border', '1');
    tbl.style.borderCollapse = 'collapse';
    
    let tbdy = document.createElement('tbody');
    let tr;
    for(let i=0; i<table.length;i++){
        if(i == 0){
            //console.log("Creating Header!");
            tr = document.createElement('tr');
            for (let j = 0; j < table[i].length; j++){
                let td = document.createElement('td');
                td.textContent = 'x' + (j+1);
                if(j == table[i].length - 1)
                    td.textContent = 'b';
                td.appendChild(document.createTextNode('\u0020'));
                tr.appendChild(td);
            }
            tbdy.appendChild(tr);  
        }
        tr = document.createElement('tr');
        for (let j = 0; j < table[i].length; j++) {
            let td = document.createElement('td');
            td.textContent = table[i][j];
            td.appendChild(document.createTextNode('\u0020'))
            tr.appendChild(td)
        }
    tbdy.appendChild(tr);
    }
    tbl.appendChild(tbdy);
    body.appendChild(tbl)
}
// Проверява форматa: знаците трябва да са оградени с интервали, индексите след 'x' - без интервал.
// Очакван формат: "3x1 + 2x2 - x3"
function validateLHS(inputdata){
    for(let i=0;i<inputdata.length;i++){
        if(inputdata[i] == '+' || inputdata[i] == '-'){
            if(i>0 && i<inputdata.length - 1){
                if(inputdata[i-1] != ' ' || inputdata[i+1] != ' '){
                    alert("Некоректен знаков формат");
                    return false;
                }
            }
        }
        if(inputdata[i] == 'x'){
            if(i<inputdata.length - 1){
                if(inputdata[i+1] == ' '){
                    alert("Некоректен индекс формат");
                    return false;
                }
                if(inputdata[i-1] == ' ' && inputdata[i-2] != '-' && i > 1){
                    if(inputdata[i-1] == ' ' && inputdata[i-2] != '+' && i > 1){
                        alert("Некоректен коефициент формат");
                        return false;
                    }
                }
            }
        }
    }
    return true;
}
function validateRHS(index){
    var rhs;
    if(index > 0){
        rhs  = document.getElementsByName("result")[index - 1].value;
        console.log('RHS: ' + rhs);
        if(rhs == ""){
            alert("Няма стойност за условието");
            return false;
        }
    }
    return true;
}
// Парсва "3x1 + 2x2 - x3" → [[3,1],[2,2],[-1,3]]
// Самотен '-' се слепва с следващия токен; липсващ коефициент (само 'x') се третира като 1.
function extractNumbers(term){
    let Z;
    let coef = [[]];
    Z = term.split(" ");
    for(let i = 0;i<Z.length;i++) {
        switch(Z[i]){
            case '+':
                Z.splice(i,1);
                break;
            case '-':
                Z[i+1] = Z[i] + Z[i+1];
                Z.splice(i,1);
                break;
        }
    }
    for(let i = 0;i<Z.length;i++) {
        coef[i] = Z[i].split('x');
    }
    for(let i = 0;i<coef.length;i++){
        switch(coef[i][0]){
            case "":  coef[i][0] = 1;  break;
            case "-": coef[i][0] = -1; break;
        }
    }
    return coef;
}
// Преобразува [[коеф,индекс],...] в плътен ред с нули за пропуснати индекси.
// Пример: [[3,1],[-1,3]] → [3, 0, -1]
function createRow(elements){
    let values = [];
    let indexes = [];
    let maxindex = 0;
    for(let i=0; i<elements.length;i++){
        values.push(Number(elements[i][0]));
        indexes.push(Number(elements[i][1]));
    }
    maxindex = Math.max(... indexes);

    for(let i = 0; i < maxindex; i++){
        if(i != indexes[i]-1){
            indexes.splice(i,0,i+1);
            values.splice(i,0,0);
        }
    }

    return values;
}
function addZeroes(table){
    let max = 0;
    for(let i=0;i<table.length;i++){
        if(table[i].length>max){
            max = table[i].length;
        }
    }

    for(let i=0;i<table.length;i++){
        if(table[i].length<max){
            for(let j = table[i].length;j<max;j++){
                table[i][j] = 0;
            }      
        }
    }
}
function transponeMatrix(matrix){
    let TM = [[]];
    for(let mci=0;mci<matrix[0].length;mci++)
        for(let mri=0;mri<matrix.length;mri++)
            TM[mci][mri] = matrix[mri][mci]
    return TM;
}
function multiplyTargetRow(table,row,value){
    let resultRow = [];
    for(let i=0;i<table[0].length;i++)
        resultRow[i] = (table[row][i]*value).toFixed(2);
    return resultRow;
}
function addTableRows(table,targetRow,BVrow){
    for(let i=0;i<table[0].length;i++){
        table[targetRow][i] = Number(table[targetRow][i]) + Number(BVrow[i]);
    }
    return table;
}