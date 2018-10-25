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
    kintone.api('/k/api/people/user/post/add', 'POST',
      {
        threadId,
        body: `<div><img class="cybozu-tmp-file" data-original="/k/api/blob/download.do?fileKey=${fileKey}" width="250" src="/k/api/blob/download.do?fileKey=${fileKey}&w=250" data-file="${fileKey}" data-width="250"></div>`,
        mentions: [],
        groupMentions:[],
        orgMentions: [],
      }, console.log, console.error
    );
  }

  static postTextToPeople(text) {
    const threadId = kintone.getLoginUser().id;
    kintone.api('/k/api/people/user/post/add', 'POST',
      {
        threadId,
        body: `<div>${text}</div>`,
        mentions: [],
        groupMentions:[],
        orgMentions: [],
      }, console.log, console.error
    );
  }
};

class Component {
  render(parentEl) {
    parentEl.appendChild(this.el_);
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

  const commentsWithDt = comments.map(comment => {
    comment.dt = new Date(comment.createdAt);
    return comment;
  });

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
  commentsWithDt.forEach(comment => {
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

  const sortedMyCommentDates = commentsWithDt
    .filter(comment => comment.creator.id === kintone.getLoginUser().id)
    .map(c => c.dt)
    .sort((a,b) => a < b ? 1 : -1);
  const latestDt = sortedMyCommentDates.length === 0 ? null : sortedMyCommentDates[0];

  return {daySeries, latestDt};
}

class Popup extends Component {
  static get CSS_CLASS() {
    return 'minitz-popup';
  }
  static get HIDDEN_CSS_CLASS() {
    return 'hidden';
  }

  constructor() {
    super();
    this.el_ = document.createElement('DIV');
    this.el_.classList.add(Popup.CSS_CLASS);
    this.el_.classList.add(Popup.HIDDEN_CSS_CLASS);
    this.el_.textContent = 'Hello minitz!';
    
    const viewWrapper = document.createElement('DIV');
    this.dayView_ = null;
    this.weekView_ = null;
    this.showDayView_ = true;
    this.latestPostDate_ = null;
    KintoneApi.fetchRecentPostsAndComments(7).then(comments => {
      const data = commentsToData(comments, 7);
      const daySeries = data.daySeries;

      this.dayView_ = new DayView({
        nDone: daySeries[0].commentCount,
        // nDone: Math.floor(Math.random()*15), // dummy data
        nGoal: 12
      });
      this.latestPostDate_ = data.latestDt;
      this.dayView_.updateMinuteIndicator(this.latestPostDate_);

      this.weekView_ = new WeekView(daySeries.reverse());
      this.dayView_.hide();
      this.weekView_.hide();
      this.dayView_.render(viewWrapper);
      this.weekView_.render(viewWrapper);

      this.updateViewVisibility_();
    });
    
    const switchButton = document.createElement('BUTTON');
    switchButton.innerText = 'Switch View';
    switchButton.addEventListener('click', (event) => {
      this.toggleView_();
    });
    
    this.el_.appendChild(switchButton);
    this.el_.appendChild(viewWrapper);

    window.setInterval(() => {
      this.dayView_.updateMinuteIndicator(this.latestPostDate_);
    }, 5000);
  }

  toggleView_() {
    this.showDayView_ = !this.showDayView_;
    this.updateViewVisibility_();
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

  show() {
    this.el_.classList.remove(Popup.HIDDEN_CSS_CLASS);
  }

  hide() {
    this.el_.classList.add(Popup.HIDDEN_CSS_CLASS);
  }
}

class ImageShareButton extends Component {
  constructor(chart) {
    super();
    this.el_ = document.createElement('BUTTON');
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

    this.input_ = document.createElement('INPUT');
    this.input_.type = 'text';
    this.input_.style.width = '250px';

    this.button_ = document.createElement('BUTTON');
    this.button_.innerText = 'POST';
    this.button_.addEventListener('click', (event) => {
      const value = this.input_.value.trim();
      if (value.match(/^\s*$/)) {
        return; // ignore when empty
      }
      const p = KintoneApi.postTextToPeople(value);
      this.input_.value = '';
      return p;
    });

    this.el_.appendChild(this.input_);
    this.el_.appendChild(this.button_);
  }
}

class DayView extends Component {
  constructor(chartData) {
    super();
    this.el_ = document.createElement('DIV');
    this.el_.classList.add('day-view');

    this.chart_ = new DayChart(chartData);
    this.poster_ = new TextPoster();

    this.minuteIndicator_ = document.createElement('DIV');

    this.chart_.render(this.el_);
    this.poster_.render(this.el_);
    this.el_.appendChild(this.minuteIndicator_);
  }

  updateMinuteIndicator(latestPostDate) {
    if (latestPostDate === null) {
      this.minuteIndicator_.innerText = `No recent people posts ever!`;
      return;
    }
    const min = Math.floor((new Date() - latestPostDate) / 1000 / 60);
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
            backgroundColor: ['rgba(255, 99, 132, 0.2)'],
            borderColor: ['rgba(255,99,132,1)'],
            borderWidth: 1
          },
          {
            label: 'commented',
            data: data.map(item => item.commentedCount),
            //backgroundColor: ['rgba(255, 99, 132, 0.2)'],
            //borderColor: ['rgba(255,99,132,1)'],
            borderWidth: 1
          },
        ]
      },
      options: {
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
            },
            stacked: true,
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
          data: [data.nDone, data.nGoal > data.nDone ? data.nGoal - data.nDone : 0],
          backgroundColor: ['rgba(54, 205, 69, 1)', 'rgba(0, 0, 0, .1)'],
          hoverBackgroundColor: ['rgba(54, 205, 69, .8)', 'rgba(0, 0, 0, .1)'],
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
          console.log(chart);
          const width = chart.chart.width;
          const height = chart.chart.height;
          const ctx = chart.chart.ctx;

          ctx.restore();
          const fontSize = (height / 124).toFixed(2);
          ctx.font = fontSize + "em Arial";
          ctx.textBaseline = "middle";
          ctx.fillStyle = '#666';

          const text = data.nGoal > data.nDone ? `${Math.floor(data.nDone / data.nGoal * 100)}%`: '+100%';
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

let isInPeople = false;
let popup = null;

const onHashChange = () => {
  const code = kintone.getLoginUser().code;
  if (!isInPeople && document.location.hash.startsWith(`#/people/user/${code}`)) {
    console.log('enter my people page.');
    popup.show();
    isInPeople = true;
  } else if (isInPeople && !document.location.hash.startsWith(`#/people/user/${code}`)) {
    console.log('leave my people page.')
    popup.hide();
    isInPeople = false;
  }
};

if ('onhashchange' in window) {
  popup = new Popup();
  popup.render(document.body);
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}

