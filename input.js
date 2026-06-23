

// Добавя динамично ред за целева функция (index=0) или ограничение (index>0).
// Използва скрит <p id="index"> като глобален брояч вместо JS променлива,
// за да оцелее при повторно зареждане без state management.
function addItem(tindex){

    var idx = document.getElementById("index");
    var label = document.createElement("label");
    var input = document.createElement("input");
    var selectZ = document.createElement("select");
    selectZ.name = "targetf";
    var selectC = document.createElement("select");
    selectC.name = "eq_type";
    var result = document.createElement("input");
    
    var zOption = [];//target function options
    zOption[0] = document.createElement("option");
    zOption[1] = document.createElement("option");
    
    var cOption = [];//constraint options
    cOption[0] = document.createElement("option");
    cOption[1] = document.createElement("option");
    cOption[2] = document.createElement("option");

    var br = document.createElement("br");
    
    label.setAttribute("name","term" + idx.textContent);
    if(idx.textContent == 0){
        label.textContent = "Целева ф-я:";
    }
    else{
        label.textContent = " Условие " + idx.textContent + ": ";
    }
    
    zOption[0].value = "min";
    zOption[0].text = "Minimize";
    zOption[1].value = "max";
    zOption[1].text = "Maximize";

    selectZ.add(zOption[0]);
    selectZ.add(zOption[1]);

    cOption[0].value = "less_equal";
    cOption[0].text = "<=";
    cOption[1].value = "equal";
    cOption[1].text = "=";
    cOption[2].value = "equal_greater";
    cOption[2].text = "=>";

    selectC.add(cOption[0]);
    selectC.add(cOption[1]);
    selectC.add(cOption[2]);    

    input.setAttribute("type","text");
    input.setAttribute("name","lhs");
    if(idx.textContent == 0){
        input.setAttribute("size","23");
        input.setAttribute("onchange","getRowData("+idx.textContent+")")
    }
    else{
        input.setAttribute("size","20");
        input.setAttribute("onchange","getRowData("+idx.textContent+")")
    }
    input.id = "index" + idx.textContent;

    result.setAttribute("type","text");
    result.setAttribute("name","result");
    result.id = "result" + idx.textContent;
    result.setAttribute("onchange","getRowData("+idx.textContent+")")

    document.getElementById("rawdata").appendChild(label);
    document.getElementById("rawdata").appendChild(input);
    if(idx.textContent == 0){
        document.getElementById("rawdata").appendChild(selectZ);
    }
    else{
        document.getElementById("rawdata").appendChild(selectC);
        result.setAttribute("size","5");
        document.getElementById("rawdata").appendChild(result);
    }
    
    document.getElementById("rawdata").appendChild(br);
    
    console.log("Global index is: " + idx.textContent);

    if(idx != null){
        let value = Number(idx.textContent);
        value++;
        idx.textContent = value;
    }
    //getLPPData();
}

