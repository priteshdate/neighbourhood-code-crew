/* =========================================
   NEIGHBOURHOOD HERO
========================================= */


/* -----------------------------------------
   DATA FOR RANDOM UPDATES
----------------------------------------- */

const updates = [

    {
        title: "New report nearby",
        text: "A road issue was reported in your area."
    },

    {
        title: "Community update",
        text: "A new neighbourhood event was added."
    },

    {
        title: "Local issue reported",
        text: "A streetlight issue was reported nearby."
    },

    {
        title: "Neighbourhood alert",
        text: "A water supply issue was reported."
    },

    {
        title: "Community activity",
        text: "Something new is happening near you."
    }

];


/* -----------------------------------------
   ELEMENTS
----------------------------------------- */

const mapPins = document.getElementById("mapPins");

const notification =
    document.getElementById("notification");

const notificationTitle =
    document.getElementById("notificationTitle");

const notificationText =
    document.getElementById("notificationText");

const notificationClose =
    document.getElementById("notificationClose");




/* -----------------------------------------
   RANDOM NUMBER
----------------------------------------- */

function random(min, max) {

    return Math.random() * (max - min) + min;

}


/* -----------------------------------------
   CREATE PIN
----------------------------------------- */

function createPin() {

    const pin = document.createElement("div");

    pin.classList.add("map-pin");


    /*
        Keep pins mostly away from the
        extreme edges of the screen.
    */

    const x = random(45, 90);

    const y = random(18, 82);


    pin.style.left = `${x}%`;

    pin.style.top = `${y}%`;


    mapPins.appendChild(pin);


    /* Play sound */

    playNotificationSound();


    /* Select random notification */

    const update =
        updates[
            Math.floor(Math.random() * updates.length)
        ];


    notificationTitle.textContent =
        update.title;

    notificationText.textContent =
        update.text;


    notification.classList.add("show");


    /*
        Remove pin after a few seconds
    */

    setTimeout(() => {

        pin.style.transition =
            "opacity 0.8s, transform 0.8s";

        pin.style.opacity = "0";

        pin.style.transform =
            "rotate(-45deg) scale(0)";


        setTimeout(() => {

            pin.remove();

        }, 800);

    }, 4000);


    /*
        Hide notification
    */

    setTimeout(() => {

        notification.classList.remove("show");

    }, 3500);

}


/* -----------------------------------------
   NOTIFICATION SOUND
----------------------------------------- */

let audioContext;


function playNotificationSound() {

    /*
        Browsers don't allow audio before
        user interaction.

        The first click on the page enables it.
    */

    if (!audioContext) return;


    const oscillator =
        audioContext.createOscillator();

    const gain =
        audioContext.createGain();


    oscillator.type = "sine";

    oscillator.frequency.setValueAtTime(
        660,
        audioContext.currentTime
    );


    oscillator.frequency.exponentialRampToValueAtTime(
        880,
        audioContext.currentTime + 0.12
    );


    gain.gain.setValueAtTime(
        0.0001,
        audioContext.currentTime
    );


    gain.gain.exponentialRampToValueAtTime(
        0.12,
        audioContext.currentTime + 0.02
    );


    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.35
    );


    oscillator.connect(gain);

    gain.connect(audioContext.destination);


    oscillator.start();

    oscillator.stop(
        audioContext.currentTime + 0.35
    );

}


/* -----------------------------------------
   ENABLE AUDIO
----------------------------------------- */

function enableAudio() {

    if (!audioContext) {

        audioContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

    }

}


/* -----------------------------------------
   USER INTERACTION
----------------------------------------- */

document.addEventListener(
    "click",
    enableAudio,
    { once: true }
);


/* -----------------------------------------
   CLOSE NOTIFICATION
----------------------------------------- */

notificationClose.addEventListener(
    "click",
    () => {

        notification.classList.remove("show");

    }
);


/* -----------------------------------------
   EXPLORE BUTTON
----------------------------------------- */

const exploreBtn =
    document.getElementById("exploreBtn");

if (exploreBtn) {

    exploreBtn.addEventListener(
        "click",
        function () {

            const section =
                document.getElementById("explore");

            if (!section) {

                console.error(
                    "Explore section not found."
                );

                return;
            }

            section.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }
    );

}

/* -----------------------------------------
   START ANIMATION
----------------------------------------- */


/*
    First pin appears after 1 second.
*/

setTimeout(() => {

    createPin();

}, 1000);


/*
    Continue creating random pins.

    Random delay between 2.5 and 5 seconds.
*/

function scheduleNextPin() {

    const delay =
        random(2500, 5000);


    setTimeout(() => {

        createPin();

        scheduleNextPin();

    }, delay);

}


scheduleNextPin();

/* =========================================
   ACTIVITY FILTERS
========================================= */

const filterButtons =
    document.querySelectorAll(".filter-btn");

const activityCards =
    document.querySelectorAll(".activity-card");


filterButtons.forEach(button => {

    button.addEventListener("click", () => {

        const selectedFilter =
            button.dataset.filter;


        /* Change active button */

        filterButtons.forEach(btn => {

            btn.classList.remove("active");

        });

        button.classList.add("active");


        /* Filter cards */

        activityCards.forEach(card => {

            const category =
                card.dataset.category;


            if (
                selectedFilter === "all" ||
                category === selectedFilter
            ) {

                card.classList.remove("hidden");

            } else {

                card.classList.add("hidden");

            }

        });

    });

});


/* =========================================
   VIEW ALL ACTIVITY
========================================= */

const viewActivityBtn =
    document.getElementById("viewActivityBtn");


viewActivityBtn.addEventListener(
    "click",
    () => {

        alert(
            "Full neighbourhood activity page coming next."
        );

    }
);

