// this exact function was just plopped in stratman and everything worked
// only change was in stratman I used graphElements.CreateIndDiv(...)
function CreateIndDiv(title, indicatorParams) {
    var newDiv = document.createElement("div");
    newDiv.className = "indBox";
    var divTitle = document.createElement("div");
    divTitle.className = "indBoxTitle";
    divTitle.innerHTML = "<p>" + title + "</p>";
    var indDelButt = document.createElement("div");
    indDelButt.className = "indDel";
    indDelButt.innerHTML = "del";

    indDelButt.addEventListener('click', function(e) {
        DeleteIndicator(newDiv);
    });


    divTitle.appendChild(indDelButt);
    newDiv.appendChild(divTitle);

    for (const [key, value] of Object.entries(indicatorParams)) {
        var paramContainerDiv = document.createElement('div');
        paramContainerDiv.style.width = '100%';
        let displayAndForm = CreateTextInputForm(newDiv, key, value);
        paramContainerDiv.innerHTML += "<p>" + key + ": </p>";
        paramContainerDiv.appendChild(displayAndForm[0]);
        paramContainerDiv.appendChild(displayAndForm[1]);
        newDiv.appendChild(paramContainerDiv);

    }
    

    return newDiv;
}

module.exports = { CreateIndDiv }