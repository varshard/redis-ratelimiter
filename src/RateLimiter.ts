import {RedisClient} from 'redis'
import {Request, Response} from "express";
import {NextFunction} from "express-serve-static-core";

export type Quota = number | ((key?: string) => Promise<number>) | ((key?: string) => number)

export interface RateLimiterOptions {
	quota: Quota
}

export function initMiddleWare(client: RedisClient, options: RateLimiterOptions) {
	return function (req: Request, res: Response, next: NextFunction) {
		const token = req.header('authorization')
		const key = `${token.substr('Bearer '.length)}:${getMinutes()}`

		client.get(key, async (err, result) => {
			if (err) {
				next(err)
			}

			const freq = parseInt(result)
			const quota = await getQuota(options.quota, key)
			if (freq >= quota) {
				next(new Error(`rate limit exceeded ${freq}/${quota}`))
			} else {
				client.multi()
					.incr(key)
					.expire(key, 59)
					.exec((err: Error) => {
						next(err)
					})
			}
		})
	}

	async function getQuota(quota: Quota, key: string): Promise<number> {
		switch (typeof quota) {
			case 'function': {
				return quota(key)
			}
			default: {
				return quota
			}
		}
	}
}

function getMinutes(): number {
	const date = new Date()
	return date.getMinutes()
}

