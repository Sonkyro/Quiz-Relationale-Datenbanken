let questions = [];
let currentQuestionIndex = 0;
let correctCount = 0;
let wrongCount = 0;

async function loadQuestions() {
  const res = await fetch("questions.json");
  questions = await res.json();
  shuffleArray(questions);
  showQuestion();
  updateScoreDisplay();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function updateScoreDisplay() {
  document.getElementById("score-display").textContent = `✅ ${correctCount} | ❌ ${wrongCount}`;
}

function showQuestion() {
  const container = document.getElementById("quiz-container");
  const nextBtn = document.getElementById("next-btn");
  container.innerHTML = "";
  nextBtn.style.display = "none";
  const canvas = document.getElementById("connection-canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentQuestionIndex >= questions.length) {
    container.innerHTML = `
      <h2 class="text-2xl font-bold text-green-600 mb-4">🎉 Quiz beendet!</h2>
      <p class="text-lg">Richtig beantwortet: <strong>${correctCount}</strong></p>
      <p class="text-lg">Falsch beantwortet: <strong>${wrongCount}</strong></p>
    `;
    return;
  }

  const q = questions[currentQuestionIndex];
  const qElem = document.createElement("div");
  qElem.classList.add("mb-4");
  qElem.innerHTML = `<h2 class="text-xl font-semibold mb-4">${q.question || ""}</h2>`;

  let checkBtn = document.createElement("button");
  checkBtn.textContent = "Überprüfen";
  checkBtn.className = "mt-4 bg-blue-500 text-white px-4 py-2 rounded float-right mr-8";
  checkBtn.onclick = () => evaluateAnswer(q, qElem);

  switch (q.type) {
    // --- Multiple Choice (Mehrfachauswahl möglich) ---
    case "multipleChoice":
      q.options.forEach(opt => {
        const label = document.createElement("label");
        label.className = "block border p-2 mb-2 rounded hover:bg-gray-100 cursor-pointer";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = opt;
        input.className = "mr-2";
        label.append(input, document.createTextNode(opt));
        qElem.appendChild(label);
      });
      break;

    // --- Wahr oder Falsch nebeneinander ---
    case "trueFalse":
      const tfContainer = document.createElement("div");
      tfContainer.className = "flex gap-4";
      ["Wahr", "Falsch"].forEach(choice => {
        const label = document.createElement("label");
        label.className = "flex items-center border p-2 rounded cursor-pointer w-1/2 justify-center hover:bg-gray-100";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "tf";
        input.value = choice.toLowerCase();
        input.className = "mr-2";
        label.append(input, document.createTextNode(choice));
        tfContainer.appendChild(label);
      });
      qElem.appendChild(tfContainer);
      break;

    // --- Lückentext (Drag & Drop) ---
    case "fillInBlank":
      // Split auf "___" und zwischen jedem Teil eine eigene Dropzone einsetzen
      const parts = q.text.split("___");
      const sentenceElem = document.createElement("p");
      // Baue HTML mit nummerierten Dropzones (data-blank-index)
      // Änderung: feste Höhe für Dropzones (h-9) und inline-flex mit zentrierter Ausrichtung
      sentenceElem.innerHTML = parts.map((part, i) => {
        if (i === parts.length - 1) return part;
        return part + `<span data-blank-index="${i}" id="dropzone-${currentQuestionIndex}-${i}" class="inline-flex items-center justify-center border-b-2 border-gray-400 px-3 py-0.5 min-w-[120px] h-9 bg-gray-50 ml-1 mr-1"></span>`;
      }).join("");
      qElem.appendChild(sentenceElem);

      const optionsContainer = document.createElement("div");
      optionsContainer.className = "flex gap-2 mt-4 flex-wrap";

      // Fokus-Management: Klick auf Dropzone setzt fokus, Klick auf Option setzt in fokussierte Dropzone
      let focusedDrop = null;
      const dropzones = []; // Referenzen sammeln

      // Helfer: Element in Dropzone platzieren (bei bestehendem Kind dieses in options zurückschieben)
      const placeInDropzone = (el, dzElem) => {
        if (!dzElem) return;
        // vorhandenes Element zurück in optionsContainer
        if (dzElem.firstElementChild && dzElem.firstElementChild !== el) {
          optionsContainer.appendChild(dzElem.firstElementChild);
        }
        // falls element schon an ziel, nichts tun
        if (dzElem.firstElementChild === el) return;
        // Element stil anpassen und verschieben: flacheres Design, zentriert
        el.style.margin = "0";
        el.style.display = "inline-flex";
        el.classList.remove("cursor-move");
        // flachere Antwortblöcke: kleinere vertikale Padding, feste Höhe und zentrierte Ausrichtung
        el.classList.remove("px-2","py-1");
        el.classList.add("px-2","py-0.5","h-8","items-center","inline-flex");
        dzElem.appendChild(el);
      };

      // Dropzone-Setup: später befüllt, aber bereits referenzierbar
      // Anzahl Lücken = parts.length - 1
      for (let i = 0; i < parts.length - 1; i++) {
        const dzId = `dropzone-${currentQuestionIndex}-${i}`;
        const dzElem = null; // placeholder; wir greifen über qElem später zu
      }

      // Optionen erzeugen (jeder Eintrag bekommt eigene ID, Duplikate sind erlaubt)
      q.options.forEach((opt, i) => {
        const drag = document.createElement("div");
        drag.textContent = opt;
        drag.draggable = true;
        drag.id = `fillopt-${currentQuestionIndex}-${i}`;
        drag.dataset.value = opt;
        // flachere Antwortblöcke: kleineres Padding, feste Höhe, inline-flex für Zentrierung
        drag.className = "bg-blue-200 px-2 py-0.5 rounded cursor-move select-none h-8 inline-flex items-center";
        // Drag: sende Element-ID
        drag.ondragstart = e => {
          e.dataTransfer.setData("text/id", drag.id);
        };
        // Klick platziert in fokussierte Dropzone oder in erste freie
        drag.onclick = () => {
          const qDropzones = Array.from(qElem.querySelectorAll("[data-blank-index]"));
          let target = null;
          if (focusedDrop !== null) target = qDropzones.find(d => +d.dataset.blankIndex === focusedDrop);
          if (!target) target = qDropzones.find(d => !d.firstElementChild);
          if (!target) target = qDropzones[0];
          placeInDropzone(drag, target);
          // bei Setzen Fokus entfernen
          focusedDrop = null;
          qDropzones.forEach(d => d.classList.remove("ring", "ring-2", "ring-blue-300"));
        };
        optionsContainer.appendChild(drag);
      });

      qElem.appendChild(optionsContainer);

      // Nun Dropzones referenzieren und Ereignisse setzen
      const qDropzones = Array.from(qElem.querySelectorAll("[data-blank-index]"));
      qDropzones.forEach(dz => {
        dz.ondragover = e => e.preventDefault();
        dz.ondrop = e => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/id");
          if (draggedId) {
            const draggedEl = document.getElementById(draggedId);
            if (draggedEl) {
              placeInDropzone(draggedEl, dz);
            }
          } else {
            // Fallback: reiner Text (kein Element aus diesem Dokument)
            const data = e.dataTransfer.getData("text/plain");
            if (data) {
              if (dz.firstElementChild) optionsContainer.appendChild(dz.firstElementChild);
              const tmp = document.createElement("div");
              tmp.textContent = data;
              tmp.className = "bg-blue-200 px-2 py-0.5 rounded inline-flex items-center h-8";
              dz.appendChild(tmp);
            }
          }
          // Fokus nach Drop entfernen
          focusedDrop = null;
          qDropzones.forEach(d => d.classList.remove("ring", "ring-2", "ring-blue-300"));
        };
        dz.onclick = () => {
          // setze Fokus auf diese Dropzone (klick als Zielauswahl)
          focusedDrop = +dz.dataset.blankIndex;
          qDropzones.forEach(d => d.classList.remove("ring", "ring-2", "ring-blue-300"));
          dz.classList.add("ring", "ring-2", "ring-blue-300");
        };
      });

      break;

    // --- Sortierfrage ---
    case "sorting":
      const list = document.createElement("ul");
      list.className = "space-y-2";
      shuffleArray(q.items);
      q.items.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        li.draggable = true;
        li.className = "border px-2 py-1 rounded bg-gray-50 cursor-move";
        li.ondragstart = e => e.dataTransfer.setData("text/plain", item);
        li.ondrop = e => {
          e.preventDefault();
          const dragged = e.dataTransfer.getData("text/plain");
          const target = e.target.textContent;
          const liElements = Array.from(list.children);
          const draggedIndex = liElements.findIndex(li => li.textContent === dragged);
          const targetIndex = liElements.findIndex(li => li.textContent === target);
          if (draggedIndex > -1 && targetIndex > -1) {
            list.insertBefore(liElements[draggedIndex], targetIndex > draggedIndex ? liElements[targetIndex].nextSibling : liElements[targetIndex]);
          }
        };
        li.ondragover = e => e.preventDefault();
        list.appendChild(li);
      });
      qElem.appendChild(list);
      break;

    // --- Paarbildung mit Linien ---
    case "matching":
      const pairsContainer = document.createElement("div");
      pairsContainer.className = "flex justify-between gap-12 relative";

      const leftCol = document.createElement("div");
      const rightCol = document.createElement("div");

      // --- Spalten befüllen ---
      q.pairs.forEach(p => {
        const l = document.createElement("div");
        l.textContent = p.left;
        l.className = "border px-2 py-1 mb-2 bg-gray-50 rounded cursor-pointer";
        leftCol.appendChild(l);
      });

      const shuffledRight = q.pairs.map(p => p.right);
      shuffleArray(shuffledRight);
      shuffledRight.forEach(r => {
        const rItem = document.createElement("div");
        rItem.textContent = r;
        rItem.className = "border px-2 py-1 mb-2 bg-blue-100 rounded cursor-pointer";
        rightCol.appendChild(rItem);
      });

      pairsContainer.append(leftCol, rightCol);
      qElem.appendChild(pairsContainer);

      // --- Canvas vorbereiten ---
      const canvas = document.getElementById("connection-canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      let selectedLeft = null;
      let connections = []; // speichert { leftElem, rightElem }

      function redrawConnections() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        connections.forEach(({ leftElem, rightElem }) => {
          const rectLeft = leftElem.getBoundingClientRect();
          const rectRight = rightElem.getBoundingClientRect();
          ctx.beginPath();
          ctx.moveTo(rectLeft.right, rectLeft.top + rectLeft.height / 2 + window.scrollY);
          ctx.lineTo(rectRight.left, rectRight.top + rectRight.height / 2 + window.scrollY);
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }

      function removeConnectionFor(elem) {
        // Alle Verbindungen löschen, die dieses Element beinhalten
        connections = connections.filter(({ leftElem, rightElem }) => {
          if (leftElem === elem || rightElem === elem) {
            leftElem.classList.remove("bg-yellow-100");
            rightElem.classList.remove("bg-green-100");
            delete leftElem.dataset.match;
            delete rightElem.dataset.match;
            return false;
          }
          return true;
        });
        redrawConnections();
      }

      leftCol.querySelectorAll("div").forEach(l => {
        l.onclick = () => {
          // Wenn bereits verbunden → Verbindung löschen
          const existing = connections.find(c => c.leftElem === l);
          if (existing) {
            removeConnectionFor(l);
            return;
          }

          // Andernfalls für neue Verbindung vormerken
          leftCol.querySelectorAll("div").forEach(div => div.classList.remove("bg-yellow-200"));
          selectedLeft = l;
          l.classList.add("bg-yellow-200");
        };
      });

      rightCol.querySelectorAll("div").forEach(r => {
        r.onclick = () => {
          // Wenn rechter Eintrag bereits verbunden → löschen
          const existing = connections.find(c => c.rightElem === r);
          if (existing) {
            removeConnectionFor(r);
            return;
          }

          // Nur verbinden, wenn linker ausgewählt ist
          if (!selectedLeft) return;

          // Alte Verbindung des linken löschen (nur eine pro Seite)
          removeConnectionFor(selectedLeft);

          // Neue Verbindung speichern
          connections.push({ leftElem: selectedLeft, rightElem: r });

          selectedLeft.classList.add("bg-yellow-100");
          r.classList.add("bg-green-100");

          selectedLeft.dataset.match = r.textContent;
          delete selectedLeft.classList.remove("bg-yellow-200");
          selectedLeft = null;

          redrawConnections();
        };
      });
      break;
    }

  qElem.appendChild(checkBtn);
  container.appendChild(qElem);
}

function evaluateAnswer(q, qElem) {
  const nextBtn = document.getElementById("next-btn");
  let correct = false;

  // einmalige Auswertung pro Frage: wenn schon ausgewertet, nichts tun
  if (qElem.dataset.answered === "true") return;
  // markiere als ausgewertet (wird verhindert, dass counter mehrfach erhöht werden)
  qElem.dataset.answered = "true";

  switch (q.type) {
    case "multipleChoice":
      const selected = Array.from(qElem.querySelectorAll("input[type='checkbox']:checked")).map(i => i.value);
      const correctAnswers = Array.isArray(q.answer) ? q.answer : [q.answer];
      correct = JSON.stringify(selected.sort()) === JSON.stringify(correctAnswers.sort());
      break;
    case "trueFalse":
      const tf = qElem.querySelector("input[type='radio']:checked");
      if (tf) correct = tf.value === q.answer.toLowerCase();
      break;
    case "fillInBlank":
      // Prüfe jede Dropzone gegen das jeweilige q.answers-Array (oder q.answer fallback)
      const dropElems = Array.from(qElem.querySelectorAll("[data-blank-index]"));
      if (Array.isArray(q.answers)) {
        correct = dropElems.every(dz => {
          const idx = +dz.dataset.blankIndex;
          const child = dz.firstElementChild;
          const val = child ? (child.dataset.value || child.textContent.trim()) : "";
          return val === (q.answers[idx] || "");
        });
      } else {
        // backward compatibility: single-answer behaviour
        const val = dropElems.map(dz => dz.firstElementChild ? (dz.firstElementChild.dataset.value || dz.firstElementChild.textContent.trim()) : "").join(" ");
        correct = val.trim() === (q.answer || q.answers || "");
      }
      break;
    case "sorting":
      const order = Array.from(qElem.querySelectorAll("li")).map(li => li.textContent);
      correct = JSON.stringify(order) === JSON.stringify(q.correctOrder);
      break;
    case "matching":
      const lefts = Array.from(qElem.querySelectorAll(".flex > div:first-child > div"));
      correct = lefts.every(l => {
        const pair = q.pairs.find(p => p.left === l.textContent.split(" →")[0]);
        return l.dataset.match === pair?.right;
      });
      break;
  }

  // Button deaktivieren, damit kein weiteres Klicken möglich ist
  const checkBtn = qElem.querySelector("button");
  if (checkBtn) {
    checkBtn.disabled = true;
    checkBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  // statt qElem Hintergrund/Border ändern: Badge zwischen Frage und Check-Button einfügen
  let badge = qElem.querySelector(".result-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "result-badge my-4 px-4 py-2 rounded text-center font-semibold";
    if (checkBtn) qElem.insertBefore(badge, checkBtn);
    else qElem.appendChild(badge);
  }

  if (correct) {
    correctCount++;
    badge.textContent = "Richtig!";
    badge.style.backgroundColor = "#bbf7d0";
    badge.style.border = "2px solid #16a34a";
    badge.style.color = "#064e3b";
    badge.style.borderRadius = "0.5rem";
  } else {
    wrongCount++;
    badge.textContent = "Falsch!";
    badge.style.backgroundColor = "#fecaca";
    badge.style.border = "2px solid #b91c1c";
    badge.style.color = "#7f1d1d";
    badge.style.borderRadius = "0.5rem";
  }

  updateScoreDisplay();
  nextBtn.style.display = "block";
  nextBtn.onclick = () => {
    currentQuestionIndex++;
    showQuestion();
  };
}

window.onload = loadQuestions;
