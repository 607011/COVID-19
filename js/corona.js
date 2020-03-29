/*
    COVID-19 spread visualization and active cases prediction.
    Copyright (c) 2020 Oliver Lau <oliver.lau@gmail.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

(function (window) {
    'use strict'

    let el = {}
    let locale = 'de-DE'
    let main_chart = null
    let diff_chart = null
    let prediction_days = 0
    let confirmed = {}
    let title = ''

    const update = data => {
        if (data) {
            confirmed = Object.assign({}, data)
            confirmed.dates = data.dates.map(date => new Date(date))
        }
        const last_update = new Date(confirmed.latest.last_update)
        document.getElementById('latest-date').innerText = `${last_update.toLocaleDateString(locale)} ${last_update.toLocaleTimeString(locale)}`
        document.getElementById('latest-total').innerText = confirmed.latest.total.toLocaleString(locale)
        document.getElementById('latest-active').innerText = confirmed.latest.active.toLocaleString(locale)
        document.getElementById('latest-deaths').innerText = confirmed.latest.deaths.toLocaleString(locale)
        document.getElementById('latest-recovered').innerText = confirmed.latest.recovered.toLocaleString(locale)
        document.getElementById('App').classList.remove('hidden')
        document.getElementById('loader-screen').classList.add('hidden')
        const curr_date = confirmed.dates[confirmed.dates.length - 1]
        let dates = [...confirmed.dates]
        for (let day = 0; day < prediction_days; ++day) {
            const date = new Date(curr_date)
            date.setDate(curr_date.getDate() + day + 1)
            dates.push(date)
        }
        const predicted = new Array(confirmed.active.length).fill(null).concat(confirmed.predicted.active.slice(0, prediction_days))
        dates = dates.map(d => d.toLocaleDateString(locale))
        el.current_date.innerText = dates[confirmed.dates.length - 1]
        el.latest_date.innerText = dates[confirmed.dates.length - 1 + prediction_days]
        el.current_cases.innerText = confirmed.active[confirmed.active.length - 1].toLocaleString(locale)
        el.latest_cases.innerText = prediction_days > 0 ? confirmed.predicted.active[prediction_days - 1].toLocaleString(locale) : el.current_cases.innerText
        if (diff_chart) {
            diff_chart.data.labels = dates.slice(0, confirmed.active.length)
            diff_chart.data.datasets[0].data = confirmed.delta
            diff_chart.update()
        }
        else {
            diff_chart = new Chart(document.getElementById('diff-chart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: dates.slice(0, confirmed.active.length),
                    datasets: [
                        {
                            data: confirmed.delta,
                            label: 'Difference',
                            backgroundColor: (function(_opaque, ctx) {
                                return ctx.dataset.data[ctx.dataIndex] < 0 ? '#63D427' : '#D42C27'
                            }).bind(null, false),
                        }
                    ]
                },
                options: {
                    title: {
                        display: true,
                        text: 'Difference in active cases',
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    legend: {
                        display: false,
                    },
                    scales: {
                        xAxes: [
                            {
                                gridLines: {
                                    display: false,
                                    drawTicks: false,
                                },
                                ticks: {
                                    display: false,
                                },
                            }
                        ],
                        yAxes: [
                            {
                                gridLines: {
                                    display: true,
                                    drawTicks: false,
                                },
                                ticks: {
                                    display: false,
                                },
                            },
                        ],    
                    },
                    animation: {
                        duration: 500,
                        easing: 'easeInOutQuad',
                    }
                }
            })
        }
        if (main_chart) {
            main_chart.data.labels = dates
            main_chart.data.datasets[3].data = predicted
            main_chart.update()
        }
        else {
            main_chart = new Chart(document.getElementById('main-chart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            data: confirmed.active,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Active',
                            backgroundColor: 'rgb(230, 88, 36)',
                            borderWidth: 0,
                            fill: 'transparent',
                            order: 2,
                        },
                        {
                            data: confirmed.recovered,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Recovered',
                            backgroundColor: '#7CDC58',
                            borderWidth: 0,
                            fill: 'transparent',
                            order: 2,
                        },
                        {
                            data: confirmed.deaths,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Deaths',
                            backgroundColor: '#D16EDC',
                            borderWidth: 0,
                            fill: 'transparent',
                            order: 3,
                        },
                        {
                            data: predicted,
                            type: 'bar',
                            yAxisID: 'A',
                            label: 'Active predicted',
                            backgroundColor: 'rgba(230, 88, 36, 0.5)',
                            borderWidth: 0,
                            fill: 'transparent',
                        },
                        {
                            data: confirmed.doubling_rates,
                            type: 'line',
                            yAxisID: 'B',
                            label: 'Days per doubling',
                            borderColor: '#5BA5E6',
                            borderWidth: 2,
                            pointStyle: 'circle',
                            fill: 'transparent',
                            showLine: false,
                            order: 0,
                        },
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    title: {
                        display: false,
                        text: title,
                    },
                    scales: {
                        xAxes: [
                            {
                                stacked: true,
                                gridLines: {
                                    display: false,
                                },
                            }
                        ],
                        yAxes: [
                            {
                                id: 'A',
                                type: 'linear',
                                position: 'right',
                                precision: 1,
                                stacked: true,
                                beginAtZero: true,
                            },
                            {
                                id: 'B',
                                type: 'linear',
                                position: 'left',
                                precision: 0.1,
                                stacked: false,
                                beginAtZero: true,
                                gridLines: {
                                    display: false,
                                },
                            },
                        ]
                    },
                    animation: {
                        duration: 500,
                        easing: 'easeInOutQuad',
                    }
                }
            })
        }
    }

    const hashChanged = _evt => {
        const [p] = window.location.hash.substring(1).split(';').filter(p => p.startsWith('predict'))
        if (p) {
            const [_, days] = p.split('=')
            prediction_days = Math.min(Math.max(0, days), +el.prediction_days.getAttribute('max'))
            el.prediction_days.value = prediction_days
            if (confirmed.active)
                update()
        }
    }

    const refresh = () => {
        fetch('data/current.json')
        .then(response => {
            return response.ok
                ? response.json()
                : Promise.reject(response.status)
        })
        .then(data => {
            title = `COVID-19 in ${data.country}`
            el.prediction_days.setAttribute('max', data.predicted.active.length)
            hashChanged()
            update(data)
        })
    }

    const main = () => {
        refresh()
        el.current_date = document.getElementById('current-date')
        el.current_cases = document.getElementById('current-cases')
        el.latest_date = document.getElementById('predicted-date')
        el.latest_cases = document.getElementById('predicted-cases')
        el.prediction_days = document.getElementById('prediction-days')
        prediction_days = +el.prediction_days.value
        window.addEventListener('hashchange', hashChanged)
        el.prediction_days.addEventListener('change', evt => {
            evt.target.value = Math.min(+evt.target.value, +el.prediction_days.getAttribute('max'))
            window.location.hash = `#predict=${evt.target.value}`
        });
        [...document.getElementsByClassName('stepper')].forEach(stepper => {
            const input = stepper.querySelector('input')
            input.previousElementSibling.addEventListener('click', _ => { input.stepDown(); input.dispatchEvent(new Event('change')) })
            input.nextElementSibling.addEventListener('click', _ => { input.stepUp(); input.dispatchEvent(new Event('change')) })
        })
    }
    window.addEventListener('load', main)
})(window)
