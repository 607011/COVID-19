/*
    COVID-19 spread visualization and active cases prediction
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

    const Config = {
        title: null,
        active: {
            label: 'Active',
            type: 'bar',
            backgroundColor: 'rgb(230, 88, 36)',
            borderWidth: 0,
        },
        predicted: {
            label: 'Active predicted',
            type: 'bar',
            backgroundColor: 'rgba(230, 88, 36, 0.5)',
            borderWidth: 0,
        },
        recovered: {
            label: 'Recovered',
            type: 'bar',
            backgroundColor: '#7CDC58',
            borderWidth: 0,
        },
        deaths: {
            label: 'Deaths',
            type: 'bar',
            backgroundColor: '#D16EDC',
            borderWidth: 0,
        },
        doubling: {
            label: 'Days per doubling',
            type: 'line',
            fill: 'transparent',
            borderColor: '#5BA5E6',
            borderWidth: 2,
            pointStyle: 'circle',
        },
        delta: {
            label: 'Difference',
            type: 'line',
            borderColor: 'rgb(88, 230, 36)',
            backgroundColor: '#444',
        },
    }
    let el = {}
    let locale = 'de-DE'
    let ctx = null
    let chart = null
    let prediction_days = 0
    let confirmed = {}

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
        if (chart) {
            chart.data.labels = dates
            chart.data.datasets[3].data = predicted
            chart.update()
        }
        else {
            chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            data: confirmed.active,
                            type: Config.active.type,
                            yAxisID: 'A',
                            label: Config.active.label,
                            backgroundColor: Config.active.backgroundColor,
                            borderColor: Config.active.borderColor,
                            borderWidth: Config.active.borderWidth,
                            fill: 'transparent',
                            order: 2,
                        },
                        {
                            data: confirmed.recovered,
                            type: Config.recovered.type,
                            yAxisID: 'A',
                            label: Config.recovered.label,
                            backgroundColor: Config.recovered.backgroundColor,
                            borderColor: Config.recovered.borderColor,
                            borderWidth: Config.recovered.borderWidth,
                            fill: 'transparent',
                            order: 2,
                        },
                        {
                            data: confirmed.deaths,
                            type: Config.deaths.type,
                            yAxisID: 'A',
                            label: Config.deaths.label,
                            backgroundColor: Config.deaths.backgroundColor,
                            borderColor: Config.deaths.borderColor,
                            borderWidth: Config.deaths.borderWidth,
                            fill: 'transparent',
                            order: 3,
                        },
                        {
                            data: predicted,
                            type: Config.predicted.type,
                            yAxisID: 'A',
                            label: Config.predicted.label,
                            backgroundColor: Config.predicted.backgroundColor,
                            borderColor: Config.predicted.borderColor,
                            borderWidth: Config.predicted.borderWidth,
                            fill: 'transparent',
                        },
                        {
                            data: confirmed.doubling_rates,
                            type: Config.doubling.type,
                            yAxisID: 'B',
                            label: Config.doubling.label,
                            borderColor: Config.doubling.borderColor,
                            borderWidth: Config.doubling.borderWidth,
                            pointStyle: Config.doubling.pointStyle,
                            fill: Config.doubling.fill,
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
                        text: Config.title,
                    },
                    scales: {
                        xAxes: [
                            {
                                stacked: true,
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

    const main = () => {
        fetch('data/current.json')
        .then(response => {
            return response.ok
                ? response.json()
                : Promise.reject(response.status)
        })
        .then(data => {
            Config.title = `COVID-19 in ${data.country}`
            el.prediction_days.setAttribute('max', data.predicted.active.length)
            update(data)
        })
        ctx = document.getElementById('progress').getContext('2d')
        el.current_date = document.getElementById('current-date')
        el.current_cases = document.getElementById('current-cases')
        el.latest_date = document.getElementById('predicted-date')
        el.latest_cases = document.getElementById('predicted-cases')
        el.prediction_days = document.getElementById('prediction-days')
        prediction_days = +el.prediction_days.value
        el.prediction_days.addEventListener('change', evt => {
            prediction_days = Math.min(+evt.target.value, +el.prediction_days.getAttribute('max'))
            evt.target.value = prediction_days
            update()
        });
        [...document.getElementsByClassName('stepper')].forEach(stepper => {
            const input = stepper.querySelector('input')
            input.previousElementSibling.addEventListener('click', _ => { input.stepDown(); input.dispatchEvent(new Event('change')) })
            input.nextElementSibling.addEventListener('click', _ => { input.stepUp(); input.dispatchEvent(new Event('change')) })
        })
    }
    window.addEventListener('load', main)
})(window)
