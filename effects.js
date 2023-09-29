const track = document.getElementById("image-track");
const imageElements = track.getElementsByClassName("image");
const imageOverlays = track.getElementsByClassName("overlay");
const popUp = document.getElementById("popup");
const popUpClose = document.getElementById("popup-close");
const popUpContentElements = popUp.getElementsByClassName("content");
const legend = document.getElementById("legend");

const hidePopUpContent = () => {
    for (let i = 0; i < popUpContentElements.length; i++) {
        popUpContentElements[i].scrollTop = 0;
        popUpContentElements[i].style.display = "none";
    }
}

const togglePopUp = (event) => {
    const imgOverlayId = (event.target.id != "popup-close")? event.target.id : undefined;

    track.classList.toggle("active");
    popUp.classList.toggle("active");
    legend.classList.toggle("active");

    if (imgOverlayId){
         // Set the content element with the id "p" + imgId to be visible
        const popupContentId = "p-" + imgOverlayId;
        const popUpContentElement = document.getElementById(popupContentId);

        if (popUp.classList.contains("active") && popUpContentElement) {
            popUpContentElement.style.display = "block";
        }
    }
    else { // popup close button is pressed
        hidePopUpContent();
    }
}

// Overlays of images toggle blur effect
for (let i = 0; i < imageOverlays.length; i++) {
    imageOverlays[i].onclick = togglePopUp; 
    let imageText = imageOverlays[i].querySelector('.image-text');

    // When text becomes visible, user click will essentially
    imageText.addEventListener('click', function(event) {
        // Get the parent element (in this case, the <div> with id "overlay")
        const parentElement = this.parentElement;
        
        // Get the id of the parent element
        const parentId = parentElement.id;
        
        // stop propagating from this element
        event.stopPropagation();
        // trigger parent element (image) click function
        parentElement.click();
    });
}

// the popup close button toggles bluer effect
popUpClose.onclick = togglePopUp;

// At initialization hide all popup elements with class "content". display them as part of toggle
// for (let i = 0; i < popUpContentElements.length; i++) {
//     popUpContentElements[i].style.display = "none";
// }
hidePopUpContent();

/* mouse event  handling */
const handleOnDown = e => {
    track.dataset.mouseDownAt = e.clientX;
}

const handleOnUp = () => {
    track.dataset.mouseDownAt = "0";
    track.dataset.prevPercentage = track.dataset.percentage || "0";
}

const handleOnMove = e => {
    if(track.dataset.mouseDownAt === "0" || track.classList.contains("active")) { 
        return;
    } 

    const mouseDelta = parseFloat(track.dataset.mouseDownAt) - e.clientX,
          maxDelta = window.innerWidth / 2;

    const percentage = (mouseDelta / maxDelta) * -100,
          nextPercentageUnconstrained = parseFloat(track.dataset.prevPercentage) + percentage,
          nextPercentage = Math.max(Math.min(nextPercentageUnconstrained, 0), -100);

    track.dataset.percentage = nextPercentage;

    track.animate({
        transform: `translate(${nextPercentage}%, -50%)`
      }, { duration: 1200, fill: "forwards" });

    for(const image of imageElements) {
    image.animate({
            objectPosition: `${100 + nextPercentage}% center`
        }, { duration: 1200, fill: "forwards" });
    }
}


/* -- Had to add extra lines for touch events -- */
window.onmousedown = e => handleOnDown(e);
window.ontouchstart = e => handleOnDown(e.touches[0]);
window.onmouseup = e => handleOnUp(e);
window.ontouchend = e => handleOnUp(e.touches[0]);
window.onmousemove = e => handleOnMove(e);
window.ontouchmove = e => handleOnMove(e.touches[0]);