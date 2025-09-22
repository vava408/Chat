const socket = io({
	auth: {
		serverOffset: 0
	}
});

const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const toggleButton = document.getElementById('toggle-btn');

let myPseudo = '';
let isNewUser = false;

// --- messages système ---
socket.on('serveur', (msg) => {
	const item = document.createElement('li');
	item.textContent = msg;
	item.classList.add('system');
	messages.appendChild(item);
	window.scrollTo(0, document.body.scrollHeight);

	if (msg === "entrer un pseudo") {
		isNewUser = true;
	}
});

// --- messages du chat ---
socket.on('chat message', (data) => {
	const item = document.createElement('li');
	item.textContent = `${data.user}: ${data.content}`;

	if (data.user === myPseudo) {
		item.classList.add('me');
	} else {
		item.classList.add('other');
	}

	messages.appendChild(item);
	window.scrollTo(0, document.body.scrollHeight);
});

// --- commande utilisateur ---
socket.on('commande', (data) => {
	const item = document.createElement('li');
	item.textContent = data;
	item.classList.add('system');
	messages.appendChild(item);
	window.scrollTo(0, document.body.scrollHeight);
});

// --- formulaire ---
form.addEventListener('submit', (e) => {
	e.preventDefault();
	if (!input.value) return;

	if (isNewUser) {
		myPseudo = input.value;
		socket.emit('pseudo', myPseudo);
		input.value = '';
		isNewUser = false;
	} else {
		socket.emit('chat client', input.value);
		input.value = '';
	}
});

// --- bouton de connexion/déconnexion ---
toggleButton.addEventListener('click', (e) => {
	e.preventDefault();

	if (socket.connected) {
		toggleButton.innerText = 'Connect';
		socket.emit('chat client', "** déconnecté **");
		socket.disconnect();
	} else {
		socket.connect();
		toggleButton.innerText = 'Disconnect';
		socket.emit('chat client', "** reconnecté **");
	}
});
