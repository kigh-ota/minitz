console.log('Hello minitz!');

const POPUP_CSS_CLASS = 'minitz-popup';
const POPUP_HIDDEN_CSS_CLASS = 'hidden';

let isInPeople = false;
const onHashChange = () => {
  // TODO: 自分のピープルだけにする
  if (!isInPeople && document.location.hash.startsWith('#/people/user/')) {
    console.log('enter the people page.');
    showPopup();
    isInPeople = true;
  } else if (isInPeople && !document.location.hash.startsWith('#/people/user/')) {
    console.log('leave the people page.')
    hidePopup();
    isInPeople = false;
  }
};

const createPopup = () => {
  let popup = document.createElement('DIV');
  popup.classList.add(POPUP_CSS_CLASS);
  popup.classList.add(POPUP_HIDDEN_CSS_CLASS);
  popup.textContent = 'Hello minitz!';
  document.body.appendChild(popup);
}

const showPopup = () => {
  document.getElementsByClassName(POPUP_CSS_CLASS)[0].classList.remove(POPUP_HIDDEN_CSS_CLASS);
};

const hidePopup = () => {
  document.getElementsByClassName(POPUP_CSS_CLASS)[0].classList.add(POPUP_HIDDEN_CSS_CLASS);
}

if ('onhashchange' in window) {
  createPopup();
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}