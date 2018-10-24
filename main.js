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
    const bin = await myChart.getImageAsBinaryString();
    console.log(bin);
  });

  popup.appendChild(button);
  popup.appendChild(myChartWrapper);
  document.body.appendChild(popup);
}

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

  getImageAsBinaryString() {
    return new Promise((resolve, reject) => {
      if (!this.canvasEl_) {
        reject("No canvas element");
      }
      this.canvasEl_.toBlob(blob => {
        const reader = new FileReader();
        reader.addEventListener('loadend', () => {
          resolve(reader.result);
        });
        reader.readAsBinaryString(blob);
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
