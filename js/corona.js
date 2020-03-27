(function (window) {
    'use strict'
    const Config = {
        title: '<automatically set>',
        confirmed: {
            url: 'COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv',
        },
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
            url: 'COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_recovered_global.csv',
            label: 'Recovered',
            type: 'bar',
            backgroundColor: '#7CDC58',
            borderWidth: 0,
        },
        deaths: {
            url: 'COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv',
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
        extra: {
            latest: {
                url: 'COVID-19-web-data/data/cases_country.csv',
            },
        },
    }
    const DataId = Object.entries(Config).filter(val => {
        const [_, obj] = val
        return obj.url
    }).map(obj => obj[0])
    let el = {}
    let locale = 'de-DE'
    let ctx = null
    let prediction_days = 0
    let doubling_rate = Infinity
    let curr_data = {}
    let chart = null
    let selected_country = 'Germany'

    const logistic = (x, b0, x0, k, s) => s * 1 / (1 + Math.exp(-1 * k * s * (x - x0)) * (s / b0 - 1))

    const select = (tag, country) => {
        const countries = curr_data[tag].rows.filter(value => value.country === country)
        if (countries.length === 0) {
            console.warn('no data available for country: ' + selected_country)
            return {}
        }
        return countries[0]
    }

    const predict_exp = (confirmed, days) => {
        const curr_cases = confirmed.active[confirmed.cases.length - 1]
        const curr_date = confirmed.dates[confirmed.dates.length - 1]
        confirmed.predicted = new Array(confirmed.cases.length).fill(null)
        for (let d = 1; d <= days; ++d) {
            confirmed.predicted.push(Math.round(curr_cases * Math.pow(2, d / doubling_rate)))
            const date = new Date(curr_date)
            date.setDate(curr_date.getDate() + d)
            confirmed.dates.push(date)
            confirmed.deaths.push(null)
            confirmed.recovered.push(null)
        }
    }

    const predict_logistic = (confirmed, days, start_date) => {

    }

    const update = data => {
        if (data instanceof Array) {
            for (const d of data.filter(v => v.which)) {
                curr_data[d.which] = d
            }
        }
        const confirmed = select('confirmed', selected_country)
        confirmed.dates = curr_data['confirmed'].dates.slice()
        confirmed.deaths = select('deaths', selected_country).cases
        confirmed.recovered = select('recovered', selected_country).cases
        confirmed.active = new Array(confirmed.cases.length)
        for (let i = 0; i < confirmed.cases.length; ++i) {
            confirmed.active[i] = confirmed.cases[i] - confirmed.deaths[i] - confirmed.recovered[i]
        }
        if (doubling_rate === Infinity) {
            doubling_rate = Math.round(10 * confirmed.doubling_rates[confirmed.doubling_rates.length - 1]) / 10
            el.doubling_rate.value = doubling_rate
        }
        predict_exp(confirmed, prediction_days)
        confirmed.dates = confirmed.dates.map(d => d.toLocaleDateString(locale))
        el.current_cases.innerText = confirmed.active[confirmed.active.length - 1]
        el.current_date.innerText = confirmed.dates[confirmed.dates.length - 1 - prediction_days]
        el.latest_cases.innerText = confirmed.predicted[confirmed.predicted.length - 1].toLocaleString(locale)
        el.latest_date.innerText = confirmed.dates[confirmed.dates.length - 1]
        if (chart) {
            chart.data.labels = confirmed.dates
            chart.data.datasets[1].data = confirmed.predicted
            chart.update()
        }
        else {
            chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: confirmed.dates,
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
                            data: confirmed.predicted,
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

    const fetchOne = which => {
        // console.debug(`Fetching '${which}' ...`)
        return fetch(Config[which].url)
            .then(response => {
                return response.ok
                    ? response.text()
                    : Promise.reject(response.status)
            })
            .then(raw_data => {
                const data = raw_data.split('\n')
                const dates = data.shift().split(',').slice(4).map(v => new Date(v))
                const rows = data.map(row => {
                    const [province, country, lat, lon, ...cases] = row.split(',')
                    const doubling_rates = [null]
                    for (let i = 1; i < cases.length; ++i) {
                        const prev_cases = cases[i - 1]
                        const curr_cases = cases[i]
                        if (prev_cases === curr_cases) {
                            doubling_rates.push(null)
                        }
                        else if (prev_cases > 0 && curr_cases > 0) {
                            const rate = curr_cases / prev_cases
                            const doubling_rate = 1 / Math.log2(rate)
                            doubling_rates.push(doubling_rate)
                        }
                        else {
                            doubling_rates.push(null)
                        }
                    }
                    return {
                        province: province,
                        country: country,
                        where: {
                            lat: parseFloat(lat),
                            lon: parseFloat(lon)
                        },
                        cases: cases.map(v => +v),
                        doubling_rates: doubling_rates,
                    }
                })
                return {
                    which: which,
                    dates: dates,
                    rows: rows,
                }
            })
    }

    const fetchLatest = () => {
        // console.debug('Fetching latest web-data ...')
        return fetch(Config.extra.latest.url)
            .then(response => {
                return response.ok
                    ? response.text()
                    : Promise.reject(response.status)
            })
            .then(raw_data => {
                const data = raw_data.split('\n')
                data.shift()
                const selected_country_data = data
                .map(row => {
                    const [country, last_update, lat, lon, cases, deaths, recovered, active] = row.split(',')
                    return {
                        country: country,
                        where: {
                            lat: parseFloat(lat),
                            lon: parseFloat(lon)
                        },
                        last_update: new Date(last_update),
                        cases: +cases,
                        deaths: +deaths,
                        recovered: +recovered,
                        active: +active,
                    }
                })
                .filter(d => d.country === selected_country)
                return (selected_country_data.length > 0)
                ? selected_country_data[0]
                : {}
            })
    }

    const updateLatest = data => {
        console.debug(data)
        document.getElementById('latest-date').innerText = `${data.last_update.toLocaleDateString(locale)} ${data.last_update.toLocaleTimeString(locale)}`
        document.getElementById('latest-total').innerText = data.cases
        document.getElementById('latest-active').innerText = data.active
        document.getElementById('latest-deaths').innerText = data.deaths
        document.getElementById('latest-recovered').innerText = data.recovered
    }

    const fetchAll = () => {
        fetchLatest().then(updateLatest)
        const promises = DataId.map(which => fetchOne(which))
        Promise.all(promises).then(data => {
            document.getElementById('App').classList.remove('hidden')
            document.getElementById('loader-screen').classList.add('hidden')
            update(data)
        })
    }

    const main = () => {
        Config.title = `COVID-19 in ${selected_country}`
        ctx = document.getElementById('progress').getContext('2d')
        el.current_date = document.getElementById('current-date')
        el.current_cases = document.getElementById('current-cases')
        el.latest_date = document.getElementById('predicted-date')
        el.latest_cases = document.getElementById('predicted-cases')
        el.prediction_days = document.getElementById('prediction-days')
        el.doubling_rate = document.getElementById('doubling-rate')
        el.doubling_rate.addEventListener('change', evt => {
            doubling_rate = +evt.target.value
            update()
        })
        prediction_days = +el.prediction_days.value
        el.prediction_days.addEventListener('change', evt => {
            prediction_days = +evt.target.value
            update()
        });
        [...document.getElementsByClassName('stepper')].forEach(stepper => {
            const input = stepper.querySelector('input')
            input.previousElementSibling.addEventListener('click', _ => { input.stepDown(); input.dispatchEvent(new Event('change')) })
            input.nextElementSibling.addEventListener('click', _ => { input.stepUp(); input.dispatchEvent(new Event('change')) })
        })
        fetchAll()
    }
    window.addEventListener('load', main)
})(window)
