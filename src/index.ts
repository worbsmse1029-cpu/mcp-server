import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { HfInference } from '@huggingface/inference'

// ES 모듈에서 .env 파일 로드
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '..', '.env') })

// Create server instance
const server = new McpServer({
    name: 'my-mcp-server',
    version: '1.0.0'
})

server.registerTool(
    'greet',
    {
        description: '이름과 언어를 입력하면 인사말을 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('인사할 사람의 이름'),
            language: z
                .enum(['ko', 'en'])
                .optional()
                .default('en')
                .describe('인사 언어 (기본값: en)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('인사말')
                    })
                )
                .describe('인사말')
        })
    },
    async ({ name, language }) => {
        const greeting =
            language === 'ko'
                ? `안녕하세요, ${name}님!`
                : `Hey there, ${name}! 👋 Nice to meet you!`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: greeting
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'calculator',
    {
        description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
        inputSchema: z.object({
            num1: z.number().describe('첫 번째 숫자'),
            num2: z.number().describe('두 번째 숫자'),
            operator: z
                .enum(['+', '-', '*', '/'])
                .describe('연산자 (+, -, *, /)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('계산 결과')
                    })
                )
                .describe('계산 결과')
        })
    },
    async ({ num1, num2, operator }) => {
        let result: number
        let resultText: string

        switch (operator) {
            case '+':
                result = num1 + num2
                resultText = `${num1} + ${num2} = ${result}`
                break
            case '-':
                result = num1 - num2
                resultText = `${num1} - ${num2} = ${result}`
                break
            case '*':
                result = num1 * num2
                resultText = `${num1} × ${num2} = ${result}`
                break
            case '/':
                if (num2 === 0) {
                    resultText = '오류: 0으로 나눌 수 없습니다.'
                } else {
                    result = num1 / num2
                    resultText = `${num1} ÷ ${num2} = ${result}`
                }
                break
            default:
                resultText = '오류: 지원하지 않는 연산자입니다.'
        }

        return {
            content: [
                {
                    type: 'text' as const,
                    text: resultText
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'time',
    {
        description: '시간대를 입력받아 해당 시간대의 현재 시각을 반환합니다.',
        inputSchema: z.object({
            timezone: z
                .string()
                .regex(/^UTC[+-]\d+$/, '시간대는 UTC+숫자 또는 UTC-숫자 형식이어야 합니다.')
                .describe('시간대 (예: UTC+9, UTC+0, UTC-5)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('현재 시각')
                    })
                )
                .describe('현재 시각')
        })
    },
    async ({ timezone }) => {
        // UTC+숫자 또는 UTC-숫자 형식 파싱
        const match = timezone.match(/^UTC([+-])(\d+)$/)
        if (!match) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: '오류: 잘못된 시간대 형식입니다. UTC+숫자 또는 UTC-숫자 형식을 사용해주세요.'
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: '오류: 잘못된 시간대 형식입니다. UTC+숫자 또는 UTC-숫자 형식을 사용해주세요.'
                        }
                    ]
                }
            }
        }

        const sign = match[1] === '+' ? 1 : -1
        const offsetHours = parseInt(match[2], 10)

        // 현재 UTC 시간 가져오기
        const now = new Date()
        const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000

        // 시간대 오프셋 적용
        const targetTime = new Date(utcTime + offsetHours * 60 * 60 * 1000 * sign)

        // 날짜와 시간 포맷팅
        const year = targetTime.getUTCFullYear()
        const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0')
        const day = String(targetTime.getUTCDate()).padStart(2, '0')
        const hours = String(targetTime.getUTCHours()).padStart(2, '0')
        const minutes = String(targetTime.getUTCMinutes()).padStart(2, '0')
        const seconds = String(targetTime.getUTCSeconds()).padStart(2, '0')

        const timeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        const resultText = `${timezone} 시간대의 현재 시각: ${timeString}`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: resultText
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'geocode',
    {
        description: '도시 이름이나 주소를 입력받아서 위도와 경도 좌표를 반환합니다.',
        inputSchema: z.object({
            query: z
                .string()
                .describe('검색할 도시 이름이나 주소 (예: "서울", "New York", "서울시 강남구")')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('위도와 경도 좌표 정보')
                    })
                )
                .describe('위도와 경도 좌표')
        })
    },
    async ({ query }) => {
        try {
            // Nominatim API 호출
            const encodedQuery = encodeURIComponent(query)
            const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=jsonv2&limit=1&addressdetails=1`
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MCP-Geocode-Tool/1.0'
                }
            })

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()

            if (!Array.isArray(data) || data.length === 0) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `"${query}"에 대한 검색 결과를 찾을 수 없습니다.`
                        }
                    ],
                    structuredContent: {
                        content: [
                            {
                                type: 'text' as const,
                                text: `"${query}"에 대한 검색 결과를 찾을 수 없습니다.`
                            }
                        ]
                    }
                }
            }

            const result = data[0]
            const lat = parseFloat(result.lat)
            const lon = parseFloat(result.lon)
            const displayName = result.display_name || query

            const resultText = `위치: ${displayName}\n위도: ${lat}\n경도: ${lon}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `오류: ${errorMessage}`
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: `오류: ${errorMessage}`
                        }
                    ]
                }
            }
        }
    }
)

server.registerTool(
    'get-weather',
    {
        description: '위도와 경도 좌표, 예보 기간을 입력받아서 해당 위치의 현재 날씨와 예보 정보를 제공합니다.',
        inputSchema: z.object({
            latitude: z
                .number()
                .min(-90)
                .max(90)
                .describe('위도 (latitude, -90 ~ 90)'),
            longitude: z
                .number()
                .min(-180)
                .max(180)
                .describe('경도 (longitude, -180 ~ 180)'),
            forecastDays: z
                .number()
                .int()
                .min(1)
                .max(16)
                .optional()
                .default(7)
                .describe('예보 기간 (일 단위, 1~16일, 기본값: 7일)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('날씨 정보')
                    })
                )
                .describe('날씨 정보')
        })
    },
    async ({ latitude, longitude, forecastDays = 7 }) => {
        try {
            // Open-Meteo API 호출
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,precipitation,weathercode&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&forecast_days=${forecastDays}&timezone=auto`
            
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()

            if (!data || !data.current_weather) {
                throw new Error('날씨 데이터를 가져올 수 없습니다.')
            }

            // 현재 날씨 정보
            const current = data.current_weather
            const currentTemp = current.temperature
            const currentWeatherCode = current.weathercode
            const currentWindSpeed = current.windspeed
            const currentWindDirection = current.winddirection

            // 날씨 코드를 텍스트로 변환하는 함수
            const getWeatherDescription = (code: number): string => {
                const weatherCodes: Record<number, string> = {
                    0: '맑음',
                    1: '대체로 맑음',
                    2: '부분적으로 흐림',
                    3: '흐림',
                    45: '안개',
                    48: '서리 안개',
                    51: '약한 이슬비',
                    53: '중간 이슬비',
                    55: '강한 이슬비',
                    56: '약한 동결 이슬비',
                    57: '강한 동결 이슬비',
                    61: '약한 비',
                    63: '중간 비',
                    65: '강한 비',
                    66: '약한 동결 비',
                    67: '강한 동결 비',
                    71: '약한 눈',
                    73: '중간 눈',
                    75: '강한 눈',
                    77: '눈알',
                    80: '약한 소나기',
                    81: '중간 소나기',
                    82: '강한 소나기',
                    85: '약한 눈 소나기',
                    86: '강한 눈 소나기',
                    95: '뇌우',
                    96: '우박을 동반한 뇌우',
                    99: '강한 우박을 동반한 뇌우'
                }
                return weatherCodes[code] || `날씨 코드: ${code}`
            }

            let resultText = `=== 현재 날씨 ===\n`
            resultText += `온도: ${currentTemp}°C\n`
            resultText += `날씨: ${getWeatherDescription(currentWeatherCode)}\n`
            resultText += `풍속: ${currentWindSpeed} km/h\n`
            resultText += `풍향: ${currentWindDirection}°\n\n`

            // 일별 예보 정보
            if (data.daily && data.daily.time) {
                resultText += `=== ${forecastDays}일 예보 ===\n`
                const daily = data.daily
                const times = daily.time
                const maxTemps = daily.temperature_2m_max || []
                const minTemps = daily.temperature_2m_min || []
                const precipitations = daily.precipitation_sum || []
                const weatherCodes = daily.weathercode || []

                for (let i = 0; i < Math.min(times.length, forecastDays); i++) {
                    const date = new Date(times[i])
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
                    resultText += `\n${dateStr} (${times[i]})\n`
                    resultText += `  날씨: ${getWeatherDescription(weatherCodes[i])}\n`
                    resultText += `  최고: ${maxTemps[i]}°C / 최저: ${minTemps[i]}°C\n`
                    if (precipitations[i] > 0) {
                        resultText += `  강수량: ${precipitations[i]} mm\n`
                    }
                }
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `오류: ${errorMessage}`
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: `오류: ${errorMessage}`
                        }
                    ]
                }
            }
        }
    }
)

// 코드 리뷰 프롬프트 템플릿
const codeReviewPromptTemplate = `다음 코드를 리뷰해주세요. 다음 항목들을 중점적으로 검토해주세요:

1. **코드 품질**
   - 가독성과 유지보수성
   - 네이밍 컨벤션
   - 코드 구조와 조직화

2. **성능**
   - 잠재적인 성능 병목
   - 최적화 가능한 부분
   - 메모리 사용 효율성

3. **보안**
   - 보안 취약점
   - 입력 검증
   - 에러 처리

4. **모범 사례**
   - 언어별 베스트 프랙티스 준수 여부
   - 디자인 패턴 적용
   - 테스트 가능성

5. **개선 제안**
   - 구체적인 개선 방안
   - 리팩토링 제안
   - 대안 코드 예시

**리뷰할 코드:**
\`\`\`
{code}
\`\`\`

위 코드에 대한 상세한 리뷰를 제공해주세요.`

// 코드 리뷰 프롬프트 등록
server.registerPrompt(
    'code-review',
    {
        description: '코드를 입력받아 코드 리뷰를 위한 프롬프트를 생성합니다.',
        argsSchema: {
            code: z.string().describe('리뷰할 코드'),
            language: z
                .string()
                .optional()
                .describe('코드 언어 (선택사항, 예: typescript, javascript, python 등)'),
            focus: z
                .string()
                .optional()
                .describe('특별히 집중할 리뷰 영역 (선택사항, 예: performance, security, readability)')
        }
    },
    async (args) => {
        const code = args.code || ''
        const language = args.language || ''
        const focus = args.focus || ''

        // 언어별 추가 지침
        const languageGuidelines: Record<string, string> = {
            typescript: '\n\n**TypeScript 특화 검토 사항:**\n- 타입 안정성과 타입 추론\n- 제네릭 사용의 적절성\n- 인터페이스와 타입 정의의 명확성',
            javascript: '\n\n**JavaScript 특화 검토 사항:**\n- ES6+ 기능 활용\n- 비동기 처리 (Promise, async/await)\n- 스코프와 클로저 사용',
            python: '\n\n**Python 특화 검토 사항:**\n- PEP 8 스타일 가이드 준수\n- 리스트 컴프리헨션 활용\n- 예외 처리와 컨텍스트 매니저 사용',
            java: '\n\n**Java 특화 검토 사항:**\n- 객체지향 설계 원칙\n- 예외 처리 전략\n- 컬렉션 프레임워크 활용',
            go: '\n\n**Go 특화 검토 사항:**\n- 에러 처리 패턴\n- 고루틴과 채널 사용\n- 인터페이스 설계'
        }

        // 집중 영역별 추가 지침
        const focusGuidelines: Record<string, string> = {
            performance: '\n\n**성능 최적화 집중 검토:**\n- 알고리즘 시간 복잡도 분석\n- 불필요한 반복문이나 중첩 루프\n- 캐싱 가능한 연산\n- 데이터베이스 쿼리 최적화',
            security: '\n\n**보안 집중 검토:**\n- SQL 인젝션 방지\n- XSS 공격 방지\n- 인증 및 권한 검증\n- 민감 정보 노출 방지',
            readability: '\n\n**가독성 집중 검토:**\n- 변수와 함수명의 명확성\n- 주석의 적절성\n- 코드 길이와 복잡도\n- 일관된 코딩 스타일'
        }

        // 프롬프트 생성
        let prompt = codeReviewPromptTemplate.replace('{code}', code)

        if (language && languageGuidelines[language.toLowerCase()]) {
            prompt += languageGuidelines[language.toLowerCase()]
        }

        if (focus && focusGuidelines[focus.toLowerCase()]) {
            prompt += focusGuidelines[focus.toLowerCase()]
        }

        return {
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: prompt
                    }
                }
            ]
        }
    }
)

// Blob을 base64로 변환하는 헬퍼 함수
async function blobToBase64(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return base64
}

// 이미지 생성 도구 등록
server.registerTool(
    'generate-image',
    {
        description: '프롬프트를 입력받아 AI로 이미지를 생성합니다.',
        inputSchema: z.object({
            prompt: z.string().describe('이미지 생성을 위한 텍스트 프롬프트')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('base64로 인코딩된 이미지 데이터 URI')
                    })
                )
                .describe('생성된 이미지')
        })
    },
    async ({ prompt }) => {
        try {
            // Hugging Face API 토큰 확인
            if (!process.env.HF_TOKEN) {
                throw new Error('HF_TOKEN 환경 변수가 설정되지 않았습니다.')
            }

            // Hugging Face Inference 클라이언트 초기화
            // 최신 버전은 자동으로 올바른 엔드포인트를 사용합니다
            const hfClient = new HfInference(process.env.HF_TOKEN)

            // Hugging Face Inference API를 사용하여 이미지 생성
            let imageBlob: Blob
            try {
                const result: any = await hfClient.textToImage({
                    model: 'black-forest-labs/FLUX.1-schnell',
                    inputs: prompt,
                    parameters: { num_inference_steps: 5 }
                })
                // 결과가 Blob인지 확인하고 변환
                imageBlob = result instanceof Blob ? result : new Blob([result])
            } catch (apiError) {
                // API 오류를 더 자세히 로깅
                const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError)
                console.error('Hugging Face API error:', apiErrorMessage)
                throw new Error(`Hugging Face API 호출 실패: ${apiErrorMessage}. HF_TOKEN이 올바르게 설정되어 있는지 확인해주세요.`)
            }

            // Blob을 base64로 변환
            const base64Data = await blobToBase64(imageBlob)
            
            // 데이터 URI 형식으로 변환
            const dataUri = `data:image/png;base64,${base64Data}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: dataUri
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: dataUri
                        }
                    ]
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `오류: ${errorMessage}`
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: `오류: ${errorMessage}`
                        }
                    ]
                }
            }
        }
    }
)

// 서버 정보와 도구 목록을 반환하는 리소스
server.resource(
    'server-info',
    'server://info',
    {
        description: '현재 서버 정보와 사용 가능한 도구 목록',
        mimeType: 'application/json'
    },
    async () => {
        const serverInfo = {
            server: {
                name: 'my-mcp-server',
                version: '1.0.0',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            },
            tools: [
                {
                    name: 'greet',
                    description: '이름과 언어를 입력하면 인사말을 반환합니다.',
                    input: {
                        name: 'string - 인사할 사람의 이름',
                        language: 'enum["ko", "en"] (optional, default: "en") - 인사 언어'
                    }
                },
                {
                    name: 'calculator',
                    description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
                    input: {
                        num1: 'number - 첫 번째 숫자',
                        num2: 'number - 두 번째 숫자',
                        operator: 'enum["+", "-", "*", "/"] - 연산자'
                    }
                },
                {
                    name: 'time',
                    description: '시간대를 입력받아 해당 시간대의 현재 시각을 반환합니다.',
                    input: {
                        timezone: 'string - 시간대 (예: UTC+9, UTC+0, UTC-5)'
                    }
                },
                {
                    name: 'geocode',
                    description: '도시 이름이나 주소를 입력받아서 위도와 경도 좌표를 반환합니다.',
                    input: {
                        query: 'string - 검색할 도시 이름이나 주소'
                    }
                },
                {
                    name: 'get-weather',
                    description: '위도와 경도 좌표, 예보 기간을 입력받아서 해당 위치의 현재 날씨와 예보 정보를 제공합니다.',
                    input: {
                        latitude: 'number (-90 ~ 90) - 위도',
                        longitude: 'number (-180 ~ 180) - 경도',
                        forecastDays: 'number (1~16, optional, default: 7) - 예보 기간 (일 단위)'
                    }
                }
            ]
        }

        return {
            contents: [
                {
                    uri: 'server://info',
                    mimeType: 'application/json',
                    text: JSON.stringify(serverInfo, null, 2)
                }
            ]
        }
    }
)

server
    .connect(new StdioServerTransport())
    .catch(console.error)
    .then(() => {
        console.log('MCP server started')
    })
