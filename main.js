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

const fetchComments = (dayCount) => {
  return kintone.api('/k/api/people/user/post/list', 'POST', {
    threadId: kintone.getLoginUser().id,
    size: 100,
  }).then(async resp => {
    const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    // data[n]: n日前
    let data = [...Array(dayCount).keys()].map(i => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      return {
        date: `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`,
        commentCount: 0,
        commentedCount: 0,
        likeCount: 0,
        likedCount: 0,
      }
    });
    const posts = resp.result.items.filter(item => {
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayCount + 1) <= new Date(item.commentedAt);
    });
    let comments = posts.slice();
    for (post of posts) {
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
    comments.forEach(comment => {
      const date = new Date(comment.createdAt);
      if (new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayCount + 1) <= date) {
        const i = Math.floor((tomorrow - date) / 1000 / 60 / 60 / 24);
        if (comment.creator.id === kintone.getLoginUser().id) {
          data[i].commentCount++;
          data[i].likedCount += comment.likeCount;
        } else {
          data[i].commentedCount++;
        }
        if (comment.liked) {
          data[i].likeCount++;
        }
      }
    });
    return data;
  });
}

class Component {
  render(parentEl) {
    parentEl.appendChild(this.el_);
  }
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
    
    const chartWrapper = document.createElement('DIV');
    this.chart_ = null;
    fetchComments(7).then(data => {
      this.chart_ = new MyChart(data.reverse());
      this.chart_.render(chartWrapper);
    });
    
    const button = document.createElement('BUTTON');
    button.innerText = 'Post Image to People';
    button.addEventListener('click', async (event) => {
      const blob = await this.chart_.getImageAsBlob();
      console.log(blob);
      const fileKey = await uploadBlob(blob);
      postToPeople(fileKey);
    });
    
    this.el_.appendChild(button);
    this.el_.appendChild(chartWrapper);
  }

  show() {
    this.el_.classList.remove(Popup.HIDDEN_CSS_CLASS);
  }

  hide() {
    this.el_.classList.add(Popup.HIDDEN_CSS_CLASS);
  }
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

const postToPeople = (fileKey) => {
  threadId = kintone.getLoginUser().id;
  kintone.api('/k/api/people/user/post/add', 'POST',
    {
      threadId,
      body: `<div><img class="cybozu-tmp-file" data-original="/k/api/blob/download.do?fileKey=${fileKey}" width="250" src="/k/api/blob/download.do?fileKey=${fileKey}&w=250" data-file="${fileKey}" data-width="250"></div>`,
      mentions: [],
      groupMentions:[],
      orgMentions: [],
    }, console.log, console.error);
};

class MyChart extends Component {
  constructor(data) {
    super();
    this.el_ = document.createElement('CANVAS');
    this.chart_ = new Chart(this.el_, {
      type: 'bar',
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
    return new Promise((resolve, reject) => {
      if (!this.el_) {
        reject("No canvas element");
      }
      this.el_.toBlob(blob => {
        resolve(blob);
      });
    });
  }
}

if ('onhashchange' in window) {
  popup = new Popup();
  popup.render(document.body);
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}
