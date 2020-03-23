(function (window) {
    'use strict'
    const Config = {
        title: 'Covid-19 in Deutschland – Gesamt',
        confirmed: {
            url: 'COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv',
            label: 'Bestätigte Fälle',
            type: 'line',
            fill: 'transparent',
            borderColor: 'rgb(230, 88, 36)',
            borderWidth: 2,
            pointStyle: 'rect',
        },
        predicted: {
            label: 'Prognose',
            type: 'line',
            fill: 'transparent',
            borderColor: 'rgba(230, 88, 36, 0.8)',
            borderWidth: 2,
            pointStyle: 'rect',
            borderDash: [ 3, 1 ],
        },
        recovered: {
            url: 'COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Recovered.csv',
            label: 'Genesen',
            type: 'line',
            fill: 'transparent',
            borderColor: '#7CDC58',
            borderWidth: 2,
            pointStyle: 'circle',
        },
        deaths: {
            url: 'COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Deaths.csv',
            label: 'Gestorben',
            type: 'line',
            fill: 'transparent',
            borderColor: '#D16EDC',
            borderWidth: 2,
            pointStyle: 'circle',
        },
        doubling: {
            label: 'Tage pro Verdoppelung',
            type: 'line',
            borderColor: '#5BA5E6',
            borderWidth: 2,
            pointStyle: 'circle',
            fill: 'transparent',
        },
        delta: {
            label: 'Differenz',
            type: 'bar',
            borderColor: 'rgb(88, 230, 36)',
            backgroundColor: '#444',
        }
    }
    const DataId = Object.entries(Config).filter(val => {
        const [key, obj] = val
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

    const select = (tag, country) => {
        const countries = curr_data[tag].rows.filter(value => value.country === country)
        if (countries.length === 0) {
            console.warn('no data available for country: ' + selected_country)
            return {}
        }
        return countries[0]
    }

    const update = data => {
        if (data instanceof Array) {
            for (const d of data) {
                curr_data[d.which] = d
            }
        }
        const confirmed = select('confirmed', selected_country)
        confirmed.dates = curr_data['confirmed'].dates.slice()
        confirmed.deaths = select('deaths', selected_country).cases
        confirmed.recovered = select('recovered', selected_country).cases
        if (doubling_rate === Infinity) {
            doubling_rate = Math.round(10 * confirmed.doubling_rates[confirmed.doubling_rates.length - 1]) / 10
            el.doubling_rate.value = doubling_rate
        }
        const curr_cases = confirmed.cases[confirmed.cases.length - 1]
        const curr_date = confirmed.dates[confirmed.dates.length - 1]
        confirmed.predicted = new Array(confirmed.cases.length - 1).fill(null)
        confirmed.predicted.push(curr_cases)
        for (let d = 1; d <= prediction_days; ++d) {
            confirmed.predicted.push(Math.round(curr_cases * Math.pow(2, d / doubling_rate)))
            const date = new Date(curr_date)
            date.setDate(curr_date.getDate() + d)
            confirmed.dates.push(date)
        }
        confirmed.dates = confirmed.dates.map(d => d.toLocaleDateString(locale))
        confirmed.delta = [null]
        for (let i = 1; i < confirmed.cases.length; ++i) {
            confirmed.delta.push(confirmed.cases[i] - confirmed.cases[i - 1])
        }
        el.current_date.innerText = curr_date.toLocaleDateString(locale)
        el.current_cases.innerText = curr_cases.toLocaleString(locale)
        el.latest_date.innerText = confirmed.dates[confirmed.dates.length - 1]
        el.latest_cases.innerText = confirmed.predicted[confirmed.predicted.length - 1].toLocaleString(locale)
        if (chart) {
            chart.data.labels = confirmed.dates
            chart.data.datasets[1].data = confirmed.predicted
            chart.update()
        }
        else {
            chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: confirmed.dates,
                    datasets: [
                        {
                            data: confirmed.cases,
                            type: Config.confirmed.type,
                            yAxisID: 'A',
                            label: Config.confirmed.label,
                            borderColor: Config.confirmed.borderColor,
                            borderWidth: Config.confirmed.borderWidth,
                            pointStyle: Config.confirmed.pointStyle,
                            fill: Config.confirmed.fill,
                            showLine: true,
                            spanGaps: true,
                            lineTension: 0.1,
                            steppedLine: false,
                            order: 1,
                        },
                        {
                            data: confirmed.predicted,
                            type: Config.predicted.type,
                            yAxisID: 'A',
                            label: Config.predicted.label,
                            borderColor: Config.predicted.borderColor,
                            borderWidth: Config.predicted.borderWidth,
                            borderDash: Config.predicted.borderDash,
                            pointStyle: Config.predicted.pointStyle,
                            fill: Config.predicted.fill,
                            showLine: true,
                            spanGaps: false,
                            lineTension: 0.1,
                            steppedLine: false,
                            order: 3,
                        },
                        {
                            data: confirmed.deaths,
                            type: Config.deaths.type,
                            yAxisID: 'A',
                            label: Config.deaths.label,
                            borderColor: Config.deaths.borderColor,
                            borderWidth: Config.deaths.borderWidth,
                            pointStyle: Config.deaths.pointStyle,
                            fill: Config.deaths.fill,
                            showLine: true,
                            spanGaps: true,
                            lineTension: 0.1,
                            steppedLine: false,
                            order: 1,
                        },
                        {
                            data: confirmed.recovered,
                            type: Config.recovered.type,
                            yAxisID: 'A',
                            label: Config.recovered.label,
                            borderColor: Config.recovered.borderColor,
                            borderWidth: Config.recovered.borderWidth,
                            pointStyle: Config.recovered.pointStyle,
                            fill: Config.recovered.fill,
                            showLine: true,
                            spanGaps: true,
                            lineTension: 0.1,
                            steppedLine: false,
                            order: 1,
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
                            spanGaps: false,
                            lineTension: 0.01,
                            order: 2,
                        },
                        {
                            data: confirmed.delta,
                            type: Config.delta.type,
                            yAxisID: 'A',
                            label: Config.delta.label,
                            backgroundColor: Config.delta.backgroundColor,
                            borderColor: Config.delta.borderColor,
                            showLine: false,
                            spanGaps: false,
                            lineTension: 0.01,
                            order: 2,
                        },
                    ]
                },
                options: {
                    responsive: true,
                    aspectRatio: 1.6,
                    title: {
                        display: true,
                        text: 'Covid-19 in Deutschland',
                    },
                    scales: {
                        yAxes: [
                            {
                                id: 'A',
                                type: 'linear',
                                position: 'right',
                                precision: 1,
                            },
                            {
                                id: 'B',
                                type: 'linear',
                                position: 'left',
                                precision: 0.1,
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
        console.debug(`Fetching '${which}' ...`)
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

    const fetchAll = () => {
        const promises = DataId.map(which => fetchOne(which))
        Promise.all(promises).then(data => {
            [...document.getElementsByClassName('hidden')].forEach(element => element.classList.remove('hidden'))
            update(data)
        })
    }

    const main = () => {
        ctx = document.getElementById('progress').getContext('2d')
        el.current_date = document.getElementById('current-date')
        el.current_cases = document.getElementById('current-cases')
        el.latest_date = document.getElementById('latest-date')
        el.latest_cases = document.getElementById('latest-cases')
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
        })
        fetchAll()
    }
    window.addEventListener('load', main)
})(window)
