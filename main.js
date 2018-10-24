const POPUP_CSS_CLASS = 'minitz-popup';
const POPUP_HIDDEN_CSS_CLASS = 'hidden';

let isInPeople = false;
const onHashChange = () => {
  const code = kintone.getLoginUser().code;
  if (!isInPeople && document.location.hash.startsWith(`#/people/user/${code}`)) {
    console.log('enter my people page.');
    showPopup();
    isInPeople = true;
  } else if (isInPeople && !document.location.hash.startsWith(`#/people/user/${code}`)) {
    console.log('leave my people page.')
    hidePopup();
    isInPeople = false;
  }
};

const fetchComments = (dayCount) => {
  // TODO: 20件以上取得する
  return kintone.api('/k/api/people/user/post/list', 'POST', {threadId: kintone.getLoginUser().id})
    .then(resp => {
      const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      // data[n]: n日前
      let data = [...Array(dayCount).keys()].map(i => {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        return {
          date: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
          myCommentCount: 0,
          othersCommentCount: 0,
        }
      });
      let comments = resp.result.items.slice();
      // TODO: 他n件のコメントも含める
      resp.result.items.forEach(item => {
        comments.push(...item.comments);
      });
      comments.forEach(item => {
        const date = new Date(item.createdAt);
        if (new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayCount + 1) <= date) {
          const i = Math.floor((tomorrow - date) / 1000 / 60 / 60 / 24);
          if (item.creator.id === kintone.getLoginUser().id) {
            data[i].myCommentCount++;
          } else {
            data[i].othersCommentCount++;
          }
        }
      });
      return data;
    });
}

const createPopup = () => {
  const popup = document.createElement('DIV');
  popup.classList.add(POPUP_CSS_CLASS);
  popup.classList.add(POPUP_HIDDEN_CSS_CLASS);
  popup.textContent = 'Hello minitz!';

  const myChartWrapper = document.createElement('DIV');
  const myChart = new MyChart([12, 19, 3, 5, 2, 3]);
  myChart.render(myChartWrapper);

  const button = document.createElement('BUTTON');
  button.innerText = 'Image';
  button.addEventListener('click', async (event) => {
    const blob = await myChart.getImageAsBlob();
    console.log(blob);
    const fileKey = await uploadBlob(blob);
    postComment(fileKey);
  });

  popup.appendChild(button);
  popup.appendChild(myChartWrapper);
  document.body.appendChild(popup);
}

const uploadBlob = (blob) => {
  const formData = new FormData();
  formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
  formData.append('file', blob, 'hoge.png');

  const url = kintone.api.url('/k/v1/file');

  return fetch(url, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData,
  }).then(resp => {
    return resp.json();
  }).then(json => {
    console.log(json);
    return json['fileKey'];
  }).catch(console.error);
};

// FIXME そのうち消す
const postComment = (fileKey) => {
  const SPACE = 1255;
  const THREAD = 3707;
  kintone.api('/k/v1/space/thread/comment', 'POST', {
    space: SPACE,
    thread: THREAD,
    comment: {
      files: [{fileKey}]
    },
  }, console.log, console.error);
};

class MyChart {
  constructor(data) {
    this.canvasEl_ = document.createElement('CANVAS');
    this.chart_ = new Chart(this.canvasEl_, {
      type: 'bar',
      data: {
        labels: ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
        datasets: [{
          label: '# of Votes',
          data: data,
          backgroundColor: ['rgba(255, 99, 132, 0.2)'],
          borderColor: ['rgba(255,99,132,1)'],
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero:true,
            }
          }]
        },
        elements: {
          line: {
            tension: 0,
          }
        }
      },
      type: 'line',
    });
  }

  render(parentEl) {
    parentEl.appendChild(this.canvasEl_);
  }

  getImageAsBlob() {
    return new Promise((resolve, reject) => {
      if (!this.canvasEl_) {
        reject("No canvas element");
      }
      this.canvasEl_.toBlob(blob => {
        resolve(blob);
      });
    });
  }
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
