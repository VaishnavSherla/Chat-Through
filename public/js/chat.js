const jwtToken = localStorage.getItem('jwt');

const socket = io('http://localhost:4000', {
    query: { token: jwtToken },
});

let recipientUser = null;
let lastFetchedTimestamp = null;

$(document).ready(function() {
    $("#messageBody .simplebar-content-wrapper").on('scroll', function () {
        if ($("#messageBody .simplebar-content-wrapper").scrollTop() == 0) {
            console.log('Fetching messages...');
            lastFetchedTimestamp = localStorage.getItem('time');
            recipientUser = localStorage.getItem('recipient');
            socket.emit('fetch-messages', { to:recipientUser, lastFetchedTimestamp });
        }
    });
});

function singleChat(username) {
    if (document.getElementById(username)) {
        localStorage.removeItem('time')
        $('.chat-welcome-section').hide();
        $('.chat-loader-section').show();
        setTimeout(() => {
            $('.chat-loader-section').hide();
        }, 700);
        
        recipientUser = username;
        
        $('#recipientUser').text(username);

        $('.chat-conversation').show();
        $('.chat-input-section').show();
        $('#userProfileBar').css('display', 'flex');

        $('.messages__history').empty();

        localStorage.setItem('recipient', recipientUser)
        fetchMessages(recipientUser);
    }

    scrollToBottom();
}

// Socket.io event listener for fetched messages
socket.on('fetched-messages', ({ messages, lastFetchedTimestamp }) => {
    messages.forEach(message => {
        prependMessage(message.sender_username, message.message, new Date(message.timestamp));
    });
    lastFetchedTimestamp = lastFetchedTimestamp
    localStorage.setItem('time', lastFetchedTimestamp);
});

socket.on('chat-message', ({ from, text }) => {
    appendMessage(from, text);
});

function sendMessage(message) {
    if (recipientUser) {
        socket.emit('send-message', { to: recipientUser, text: message });
    } else {
        console.error('Recipient user not selected.');
    }
}

function prependMessage(from, text, time = null) {
    if (!time) {
        time = new Date().toLocaleTimeString();
    } else {
        if (time instanceof Date && !isNaN(time)) {
            time = new Date(time).toLocaleTimeString();
        } else {
            console.error('Invalid timestamp format:', time);
            return;
        }
    }

    const currentUser = localStorage.getItem('user');
    const messageSide = from === currentUser ? 'right' : 'left';

    const messageHTML = `
        <li class="${messageSide}">
            <div class="conversation-list">
                <div class="chat-avatar">
                    <!-- Avatar or initials -->
                </div>
                <div class="user-chat-content">
                    <div class="ctext-wrap">
                        <div class="ctext-wrap-content">
                            <p>${text}</p>
                            <p class="chat-time mb-0">${time}</p>
                        </div>
                    </div>
                </div>
            </div>
        </li>
    `;

    $('.messages__history').prepend(messageHTML);
}

function appendMessage(from, text, time = null) {
    if (!time) {
        time = new Date().toLocaleTimeString();
    } else {
        if (time instanceof Date && !isNaN(time)) {
            time = new Date(time).toLocaleTimeString();
        } else {
            console.error('Invalid timestamp format:', time);
            return; // Or handle this case appropriately
        }
    }

    const currentUser = localStorage.getItem('user');
    const messageSide = from === currentUser ? 'right' : 'left';

    const messageHTML = `
        <li class="${messageSide}">
            <div class="conversation-list">
                <div class="chat-avatar">
                    <!-- Avatar or initials -->
                </div>
                <div class="user-chat-content">
                    <div class="ctext-wrap">
                        <div class="ctext-wrap-content">
                            <p>${text}</p>
                            <p class="chat-time mb-0">${time}</p>
                        </div>
                    </div>
                </div>
            </div>
        </li>
    `;

    $('.messages__history').append(messageHTML);
    scrollToBottom();
}

function scrollToBottom() {
    const messageHistory = document.querySelector('.messages__history');
    messageHistory.scrollTop = messageHistory.scrollHeight;
}

function fetchUsers() {
    $.ajax({
        url: '/getUsers',
        method: 'GET',
        beforeSend: function() {
            $('.loader_bg').show();
        },
        success: function(users) {
            $('.loader_bg').hide();
            $('#users').empty();

            users.forEach(function(user) {
                const user_img = user.userImg && user.userImg[0] !== undefined ?
                    `<img src="assets/images/users/${user.userImg[0]}" class="rounded-circle avatar-xs" alt="">` :
                    `<div class="avatar-xs"><span class="avatar-title rounded-circle bg-soft-primary text-primary">${user.username[0]}</span></div>`;

                const createdAt = user.createdAt ? user.createdAt : '';
                
                const userBox = `
                    <li id="${user.username}">
                        <a href="javascript:void(0);" onclick="singleChat('${user.username}')">
                            <div class="d-flex">                            
                                <div class="chat-user-img align-self-center me-3 ms-0">
                                    ${user_img}
                                    <span class="user-status"></span>
                                </div>
                                <div class="flex-grow-1 overflow-hidden">
                                    <h5 class="text-truncate font-size-15 mb-1">${user.username}</h5>
                                    <p class="text-truncate mb-0 lh-sm"><span class="chat-user-message"></span><span class="typing"></span></p>
                                </div>
                                <div class="font-size-11 message_time">${createdAt}</div>
                            </div>
                        </a>
                    </li>
                `;

                $('#users').append(userBox);
            });
        },
        error: function(err) {
            $('.loader_bg').hide();
            console.error('Error fetching users:', err);
        }
    });
}

$(document).ready(function() {
    $('.chat-conversation').hide()
    fetchUsers();
});


function fetchMessages(to) {
    lastFetchedTimestamp = localStorage.getItem('time')
    socket.emit('fetch-messages', { to,  lastFetchedTimestamp});
    
    socket.on('fetch-messages-error', (err) => {
        console.error('Error fetching messages:', err);
    });
}


$('#sendMessageBtn').click(() => {
    const message = $('#message').val().trim();

    if (message === '') {
        $('#singleMessage').text('Please enter a message.');
        return;
    }

    $('#singleMessage').text('');
    sendMessage(message);
    $('#message').val('');
});
