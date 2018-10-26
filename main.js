class KintoneApi {
  static fetchRecentPostsAndComments(dayCount) {
    return kintone.api('/k/api/people/user/post/list', 'POST', {
      threadId: kintone.getLoginUser().id,
      size: 100,
    }).then(async resp => {
      const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
      const posts = resp.result.items.filter(item => {
        return new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayCount + 1) <= new Date(item.commentedAt);
      });
      let comments = posts.slice();
      for (let post of posts) {
        if (post.comments.length < post.commentCount) {
          await kintone.api('/k/api/people/user/comment/list', 'POST', {
            postId: post.id,
            size: 200,
          }).then(resp => {
            comments.push(...resp.result.items);
          });
        } else {
          comments.push(...post.comments);
        }
      }
      return comments;
    });
  }

  static uploadBlob(blob) {
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
  }

  static postImageToPeople(fileKey) {
    const threadId = kintone.getLoginUser().id;
    return kintone.api('/k/api/people/user/post/add', 'POST',
      {
        threadId,
        body: `<div><img class="cybozu-tmp-file" data-original="/k/api/blob/download.do?fileKey=${fileKey}" width="250" src="/k/api/blob/download.do?fileKey=${fileKey}&w=250" data-file="${fileKey}" data-width="250"></div>`,
        mentions: [],
        groupMentions:[],
        orgMentions: [],
      }
    );
  }

  static postTextToPeople(text) {
    const threadId = kintone.getLoginUser().id;
    return kintone.api('/k/api/people/user/post/add', 'POST',
      {
        threadId,
        body: `<div>${text}</div>`,
        mentions: [],
        groupMentions:[],
        orgMentions: [],
      }
    );
  }

  static postTextToTodaysPeople(text) {
    // seek today's latest post
    const now = new Date();
    const myTodaysPosts = store.comments.filter(comment => {
      return comment.creator.id === kintone.getLoginUser().id && // my
        now.getFullYear() === comment.dt.getFullYear() && // today
        now.getMonth() === comment.dt.getMonth() &&
        now.getDate() === comment.dt.getDate() &&
        !!comment.threadId; // post
      }).sort((a,b) => a.dt < b.dt ? 1 : -1);
    if (myTodaysPosts.length > 0) {
      // comment to post
      const post = myTodaysPosts[0];
      return kintone.api('/k/api/people/user/comment/add', 'POST',
        {
          body: `<div>${text}</div>`,
          mentions: [],
          groupMentions:[],
          orgMentions: [],
          postId: post.id,
        }
      );
    } else {
      // post newly
      return KintoneApi.postTextToPeople(text);
    }
  }
};

class Component extends EventTarget {
  render(parentEl) {
    this.parentEl_ = parentEl;
    parentEl.appendChild(this.el_);
  }

  remove() {
    this.parentEl_.removeChild(this.el_);
  }

  show() {
    this.el_.style.display = '';
  }

  hide() {
    this.el_.style.display = 'none';
  }
}

function commentsToData(comments, dayCount) {
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  // daySeries[n]: n日前
  let daySeries = [...Array(dayCount).keys()].map(i => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    return {
      date: `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`,
      commentCount: 0,
      commentedCount: 0,
      likeCount: 0,
      likedCount: 0,
    }
  });
  comments.forEach(comment => {
    if (new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayCount + 1) <= comment.dt) {
      const i = Math.floor((tomorrow - comment.dt) / 1000 / 60 / 60 / 24);
      if (comment.creator.id === kintone.getLoginUser().id) {
        daySeries[i].commentCount++;
        daySeries[i].likedCount += comment.likeCount;
      } else {
        daySeries[i].commentedCount++;
      }
      if (comment.liked) {
        daySeries[i].likeCount++;
      }
    }
  });

  const sortedMyCommentDates = comments
    .filter(comment => comment.creator.id === kintone.getLoginUser().id)
    .map(c => c.dt)
    .sort((a,b) => a < b ? 1 : -1);
  const latestDt = sortedMyCommentDates.length === 0 ? null : sortedMyCommentDates[0];

  return {daySeries, latestDt};
}

const COMMENT_COUNT_GOAL = 12;
const UNACHIEVED_COLOR = 'rgba(249, 166, 2, 1)';
const HOVER_UNACHIEVED_COLOR = 'rgba(249, 166, 2, .8)';
const ACHIEVED_COLOR = 'rgba(54, 205, 69, 1)';
const HOVER_ACHIEVED_COLOR = 'rgba(54, 205, 69, .8)';

class Popup extends Component {
  static get CSS_CLASS() {
    return 'minitz-popup';
  }
  static get HIDDEN_CSS_CLASS() {
    return 'hidden';
  }

  static get MINIMIZE_CSS_CLASS() {
    return 'minimized';
  }

  constructor(comments) {
    super();
    this.el_ = document.createElement('DIV');
    this.el_.classList.add(Popup.CSS_CLASS);
    this.el_.classList.add(Popup.HIDDEN_CSS_CLASS);
    
    const viewWrapper = document.createElement('DIV');
    viewWrapper.classList.add('minitz-view-wrapper');
    this.dayView_ = null;
    this.weekView_ = null;
    this.showDayView_ = true;
    this.latestPostDate_ = null;

    this.updateView_(comments, viewWrapper);
    
    const switchButton = document.createElement('BUTTON');
    switchButton.classList.add('minitz-switch-button');
    switchButton.textContent = 'Show Weekly Report';
    switchButton.addEventListener('click', (event) => {
      this.toggleView_();
      switchButton.textContent = this.showDayView_ ? 'Show Weekly Report' : 'Show Daily Report';
    });

    const minimizeButton = new MinimizeButton(this);
    
    minimizeButton.render(this.el_);
    this.el_.appendChild(switchButton);
    this.el_.appendChild(viewWrapper);

    this.elapsedSecondsSinceLastPost_ = null;

    window.setInterval(async () => {
      this.dayView_.updateMinuteIndicator(this.latestPostDate_);

      const prev = this.elapsedSecondsSinceLastPost_;
      const curr = Math.floor((new Date() - this.latestPostDate_) / 1000);
      if (this.elapsedSecondsSinceLastPost_) {
        const nextThreshold = (Math.floor(prev / 60) + NOTIFICATION_INTERVAL_MIN) * 60;
        if (curr >= nextThreshold) {
          // n分おきに
          if (curr > NOTIFICATION_AFTER_MIN * 60 && this.latestPostDate_) {  // 直近n日間に投稿がなければデスクトップ通知しない
            showDesktopNotification(`${nextThreshold / 60}分間何も書いていません。分報を書いてはいかが？`);
          }
          await updateStoreComments();
          this.updateView_(store.comments, viewWrapper);
        }
      }
      this.elapsedSecondsSinceLastPost_ = curr;

    }, 5000);
  }

  toggleView_() {
    this.showDayView_ = !this.showDayView_;
    this.updateViewVisibility_();
  }

  updateMinimizedOrNot() {
    if (store.minimized) {
      this.el_.classList.add(Popup.MINIMIZE_CSS_CLASS);
    } else {
      this.el_.classList.remove(Popup.MINIMIZE_CSS_CLASS);
    }
  }

  updateViewVisibility_() {
    if (this.showDayView_) {
      this.dayView_.show();
      this.weekView_.hide();
    } else {
      this.weekView_.show();
      this.dayView_.hide();
    }
  }

  updateView_(comments, el) {
    if (this.dayView_) {
      this.dayView_.remove();
    }
    if (this.weekView_) {
      this.weekView_.remove();
    }

    const data = commentsToData(comments, DAY_COUNT);
    const daySeries = data.daySeries;

    this.dayView_ = new DayView(daySeries[0].commentCount);
    this.latestPostDate_ = data.latestDt;
    this.dayView_.updateMinuteIndicator(this.latestPostDate_);

    this.weekView_ = new WeekView(daySeries.reverse());
    this.dayView_.hide();
    this.weekView_.hide();
    this.dayView_.render(el);
    this.weekView_.render(el);

    this.updateViewVisibility_();
    this.updateMinimizedOrNot();

    this.dayView_.addEventListener('update', async (event) => {
      await updateStoreComments();
      this.updateView_(store.comments, el);
    });
  }

  show() {
    this.el_.classList.remove(Popup.HIDDEN_CSS_CLASS);
  }

  hide() {
    this.el_.classList.add(Popup.HIDDEN_CSS_CLASS);
  }
}

class MinimizeButton extends Component {
  constructor(popup) {
    super();
    this.el_ = document.createElement('BUTTON');
    this.el_.classList.add('minitz-minimize-button');
    this.updateInnerText_();
    this.el_.addEventListener('click', (event) => {
      toggleMinimizedState();
      popup.updateMinimizedOrNot();
      this.updateInnerText_();
    });
  }

  updateInnerText_() {
    this.el_.innerText = store.minimized ? '🕐' : '▼';
  }
}

class ImageShareButton extends Component {
  constructor(chart) {
    super();
    this.el_ = document.createElement('BUTTON');
    this.el_.classList.add('minitz-share-button');
    this.el_.innerText = 'Post Image to People';
    this.el_.addEventListener('click', async (event) => {
      const blob = await chart.getImageAsBlob();
      const fileKey = await KintoneApi.uploadBlob(blob);
      KintoneApi.postImageToPeople(fileKey);
    });
  }
}

class WeekView extends Component {
  constructor(chartData) {
    super();
    this.el_ = document.createElement('DIV');
    this.el_.classList.add('week-view');

    this.chart_ = new WeekChart(chartData);
    this.imageShareButton_ = new ImageShareButton(this.chart_);

    this.chart_.render(this.el_);
    this.imageShareButton_.render(this.el_);
  }
}

class TextPoster extends Component {
  constructor() {
    super();
    this.el_ = document.createElement('DIV');
    this.el_.classList.add('minitz-text-poster');

    this.input_ = document.createElement('INPUT');
    this.input_.type = 'text';
    this.input_.classList.add('minitz-post-text');

    this.button_ = document.createElement('BUTTON');
    this.button_.type = 'submit';
    this.button_.classList.add('minitz-post-button');
    this.button_.innerText = 'POST';

    this.form_ = document.createElement('FORM');
    this.form_.addEventListener('submit', (event) => {
      event.preventDefault();

      const value = this.input_.value.trim();
      if (!value.match(/^\s*$/)) {
        // ignore when empty
        KintoneApi.postTextToTodaysPeople(value).then(() => {
          this.dispatchEvent(new Event('posted'));
        });
        this.input_.value = '';
      }
    });

    this.form_.appendChild(this.input_);
    this.form_.appendChild(this.button_);
    this.el_.appendChild(this.form_);
  }
}

class DayView extends Component {
  constructor(chartData) {
    super();
    this.el_ = document.createElement('DIV');
    this.el_.classList.add('day-view');

    this.chart_ = new DayChart(chartData);
    this.poster_ = new TextPoster();
    this.poster_.addEventListener('posted', (event) => {
      this.dispatchEvent(new Event('update'));
    });

    this.minuteIndicator_ = document.createElement('DIV');
    this.minuteIndicator_.classList.add('minitz-description');

    this.chart_.render(this.el_);
    this.poster_.render(this.el_);
    this.el_.appendChild(this.minuteIndicator_);
  }

  updateMinuteIndicator(latestPostDate) {
    if (latestPostDate === null) {
      this.minuteIndicator_.innerText = `No recent people posts ever!`;
      return;
    }
    const min = Math.max(Math.floor((new Date() - latestPostDate) / 1000 / 60), 0); // 投稿直後負になる突貫対応
    if (min || min === 0) {
      this.minuteIndicator_.innerText = `${min} minutes since last people post.`
    }
  }
}

class WeekChart extends Component {
  constructor(data) {
    super();
    this.el_ = document.createElement('CANVAS');
    this.chart_ = new Chart(this.el_, {
      data: {
        labels: data.map(item => item.date.substr(5)),
        datasets: [
          {
            label: 'comment',
            data: data.map(item => item.commentCount),
            backgroundColor: data.map(item => {
              return item.commentCount < COMMENT_COUNT_GOAL ? UNACHIEVED_COLOR: ACHIEVED_COLOR
            }),
            hoverBackgroundColor: data.map(item => {
              return item.commentCount < COMMENT_COUNT_GOAL ? HOVER_UNACHIEVED_COLOR: HOVER_ACHIEVED_COLOR
            }),
            borderWidth: 0,
          },
          {
            data: data.map(_ => COMMENT_COUNT_GOAL),
            type: 'line',
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
          }
        ]
      },
      options: {
        legend: {
          display: false,
        },
        tooltips: {
          enabled: false,
        },
        scales: {
          xAxes: [{
            gridLines: {
              display: false,
            },
          }],
          yAxes: [{
            ticks: {
              beginAtZero: true,
              suggestedMax: 15,
            },
            gridLines: {
              display: false,
            },
          }]
        },
        elements: {
          line: {
            tension: 0,
          }
        }
      },
      type: 'bar',
    });
  }
  
  getImageAsBlob() {
    return canvasToBlob(this.el_);
  }
}

class DayChart extends Component {
  constructor(data) {
    super();

    this.el_ = document.createElement('CANVAS');
    // const ctx = this.el_.getContext('2d');
    // ctx.font = '20px Arial';
    this.chart_ = new Chart(this.el_, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [
            data,
            COMMENT_COUNT_GOAL > data ? COMMENT_COUNT_GOAL - data : 0
          ],
          backgroundColor: [
            data < COMMENT_COUNT_GOAL ? UNACHIEVED_COLOR: ACHIEVED_COLOR,
            'rgba(0, 0, 0, .1)'
          ],
          hoverBackgroundColor: [
            data < COMMENT_COUNT_GOAL ? HOVER_UNACHIEVED_COLOR: HOVER_ACHIEVED_COLOR,
            'rgba(0, 0, 0, .1)'
          ],
          borderWidth: [0, 0],
        }],
      },
      options: {
        tooltips: {
          enabled: false,
        },
      },
      plugins: [{
        afterDraw: (chart, options) => {
          const width = chart.chart.width;
          const height = chart.chart.height;
          const ctx = chart.chart.ctx;

          ctx.restore();
          const fontSize = (height / 124).toFixed(2);
          ctx.font = fontSize + "em Arial";
          ctx.textBaseline = "middle";
          ctx.fillStyle = '#666';

          const text = COMMENT_COUNT_GOAL > data ? `${Math.floor(data / COMMENT_COUNT_GOAL * 100)}%`: '+100%';
          const textX = Math.round((width - ctx.measureText(text).width) / 2);
          const textY = height / 2 + 4;
          ctx.fillText(text, textX, textY);
          ctx.save();
        },
      }],
    });
  }

  getImageAsBlob() {
    return canvasToBlob(this.el_);
  }
}

const canvasToBlob = (canvasEl) => {
  return new Promise((resolve, reject) => {
    if (!canvasEl) {
      reject("No canvas element");
    }
    canvasEl.toBlob(blob => {
      resolve(blob);
    });
  });
}

function showDesktopNotification(body) {
  window.postMessage({ type: 'MINITZ_DESKTOP_NTF_REQUEST', body }, '*');
}

const LOCALSTORAGE_KEY_MINIMIZED = 'minitz-minimized';
function getMinimizedFromLocalStorage() {
  const val = localStorage.getItem(LOCALSTORAGE_KEY_MINIMIZED) === 'true';
  if (!val) {
    localStorage.setItem(LOCALSTORAGE_KEY_MINIMIZED, false);
  }
  return val;
}
function toggleMinimizedState() {
  store.minimized = !store.minimized;
  localStorage.setItem(LOCALSTORAGE_KEY_MINIMIZED, store.minimized);
}

async function updateStoreComments() {
  const comments = await KintoneApi.fetchRecentPostsAndComments(DAY_COUNT);
  store.comments = comments.map(comment => {
    comment.dt = new Date(comment.createdAt);
    return comment;
  });
}

let popup = null;
let store = {
  comments: null,
  minimized: getMinimizedFromLocalStorage(),
};
const DAY_COUNT = 7;
const NOTIFICATION_INTERVAL_MIN = 1;
const NOTIFICATION_AFTER_MIN = 30;

updateStoreComments().then(() => {
  popup = new Popup(store.comments);
  popup.render(document.body);
  popup.show();
});
