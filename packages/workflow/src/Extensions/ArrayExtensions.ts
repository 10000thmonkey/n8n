import { ExpressionError, ExpressionExtensionError } from '../ExpressionError';
import type { ExtensionMap } from './Extensions';
import { compact as oCompact, merge as oMerge } from './ObjectExtensions';

function deepCompare(left: unknown, right: unknown): boolean {
	if (left === right) {
		return true;
	}

	// Check to see if they're the basic type
	if (typeof left !== typeof right) {
		return false;
	}

	if (typeof left === 'number' && isNaN(left) && isNaN(right as number)) {
		return true;
	}

	// Quickly check how many properties each has to avoid checking obviously mismatching
	// objects
	if (Object.keys(left as object).length !== Object.keys(right as object).length) {
		return false;
	}

	// Quickly check if they're arrays
	if (Array.isArray(left) !== Array.isArray(right)) {
		return false;
	}

	// Check if arrays are equal, ordering is important
	if (Array.isArray(left)) {
		if (left.length !== (right as unknown[]).length) {
			return false;
		}
		return left.every((v, i) => deepCompare(v, (right as object[])[i]));
	}

	// Check right first quickly. This is to see if we have mismatched properties.
	// We'll check the left more indepth later to cover all our bases.
	for (const key in right as object) {
		if ((left as object).hasOwnProperty(key) !== (right as object).hasOwnProperty(key)) {
			return false;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		} else if (typeof (left as any)[key] !== typeof (right as any)[key]) {
			return false;
		}
	}

	// Check left more in depth
	for (const key in left as object) {
		if ((left as object).hasOwnProperty(key) !== (right as object).hasOwnProperty(key)) {
			return false;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		} else if (typeof (left as any)[key] !== typeof (right as any)[key]) {
			return false;
		}

		if (
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			typeof (left as any)[key] === 'object'
		) {
			if (
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
				(left as any)[key] !== (right as any)[key] &&
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
				!deepCompare((left as any)[key], (right as any)[key])
			) {
				return false;
			}
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			if ((left as any)[key] !== (right as any)[key]) {
				return false;
			}
		}
	}

	return true;
}

function first(value: unknown[]): unknown {
	return value[0];
}

function isBlank(value: unknown[]): boolean {
	return value.length === 0;
}

function isPresent(value: unknown[]): boolean {
	return value.length > 0;
}

function last(value: unknown[]): unknown {
	return value[value.length - 1];
}

function length(value: unknown[]): number {
	return Array.isArray(value) ? value.length : 0;
}

function pluck(value: unknown[], extraArgs: unknown[]): unknown[] {
	if (!Array.isArray(extraArgs)) {
		throw new ExpressionError('arguments must be passed to pluck');
	}
	const fieldsToPluck = extraArgs;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (value as any[]).map((element: object) => {
		const entries = Object.entries(element);
		return entries.reduce((p, c) => {
			const [key, val] = c as [string, Date | string | number];
			if (fieldsToPluck.includes(key)) {
				Object.assign(p, { [key]: val });
			}
			return p;
		}, {});
	}) as unknown[];
}

function random(value: unknown[]): unknown {
	const len = value === undefined ? 0 : value.length;
	return len ? value[Math.floor(Math.random() * len)] : undefined;
}

function unique(value: unknown[], extraArgs: string[]): unknown[] {
	if (extraArgs.length) {
		return value.reduce<unknown[]>((l, v) => {
			if (typeof v === 'object' && v !== null && extraArgs.every((i) => i in v)) {
				const alreadySeen = l.find((i) =>
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
					extraArgs.every((j) => deepCompare((i as any)[j], (v as any)[j])),
				);
				if (!alreadySeen) {
					l.push(v);
				}
			}
			return l;
		}, []);
	}
	return value.reduce<unknown[]>((l, v) => {
		if (l.findIndex((i) => deepCompare(i, v)) === -1) {
			l.push(v);
		}
		return l;
	}, []);
}

function sum(value: unknown[]): number {
	return value.reduce((p: number, c: unknown) => {
		if (typeof c === 'string') {
			return p + parseFloat(c);
		}
		if (typeof c !== 'number') {
			return NaN;
		}
		return p + c;
	}, 0);
}

function min(value: unknown[]): number {
	return Math.min(
		...value.map((v) => {
			if (typeof v === 'string') {
				return parseFloat(v);
			}
			if (typeof v !== 'number') {
				return NaN;
			}
			return v;
		}),
	);
}

function max(value: unknown[]): number {
	return Math.max(
		...value.map((v) => {
			if (typeof v === 'string') {
				return parseFloat(v);
			}
			if (typeof v !== 'number') {
				return NaN;
			}
			return v;
		}),
	);
}

export function average(value: unknown[]) {
	// This would usually be NaN but I don't think users
	// will expect that
	if (value.length === 0) {
		return 0;
	}
	return sum(value) / value.length;
}

function compact(value: unknown[]): unknown[] {
	return value
		.filter((v) => v !== null && v !== undefined)
		.map((v) => {
			if (typeof v === 'object' && v !== null) {
				return oCompact(v);
			}
			return v;
		});
}

function smartJoin(value: unknown[], extraArgs: string[]): object {
	const [keyField, valueField] = extraArgs;
	if (!keyField || !valueField || typeof keyField !== 'string' || typeof valueField !== 'string') {
		throw new ExpressionExtensionError(
			'smartJoin requires 2 arguments: keyField and nameField. e.g. .smartJoin("name", "value")',
		);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
	return value.reduce<any>((o, v) => {
		if (typeof v === 'object' && v !== null && keyField in v && valueField in v) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			o[(v as any)[keyField]] = (v as any)[valueField];
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return o;
	}, {});
}

function chunk(value: unknown[], extraArgs: number[]) {
	const [chunkSize] = extraArgs;
	if (typeof chunkSize !== 'number') {
		throw new ExpressionExtensionError('chunk requires 1 parameter: chunkSize. e.g. .chunk(5)');
	}
	const chunks: unknown[][] = [];
	for (let i = 0; i < value.length; i += chunkSize) {
		// I have no clue why eslint thinks 2 numbers could be anything but that but here we are
		// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
		chunks.push(value.slice(i, i + chunkSize));
	}
	return chunks;
}

function filter(value: unknown[], extraArgs: unknown[]): unknown[] {
	const [field, term] = extraArgs as [string | (() => void), unknown | string];
	if (typeof field !== 'string' && typeof field !== 'function') {
		throw new ExpressionExtensionError(
			'filter requires 1 or 2 arguments: (field and term), (term and [optional keepOrRemove "keep" or "remove" default "keep"] (for string arrays)), or function. e.g. .filter("type", "home") or .filter((i) => i.type === "home") or .filter("home", [optional keepOrRemove]) (for string arrays)',
		);
	}
	if (value.every((i) => typeof i === 'string') && typeof field === 'string') {
		return (value as string[]).filter((i) =>
			term === 'remove' ? !i.includes(field) : i.includes(field),
		);
	} else if (typeof field === 'string') {
		return value.filter(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
			(v) => typeof v === 'object' && v !== null && field in v && (v as any)[field] === term,
		);
	}
	return value.filter(field);
}

function renameKeys(value: unknown[], extraArgs: string[]): unknown[] {
	if (extraArgs.length === 0 || extraArgs.length % 2 !== 0) {
		throw new ExpressionExtensionError(
			'renameKeys requires an even amount of arguments: from1, to1 [, from2, to2, ...]. e.g. .renameKeys("name", "title")',
		);
	}
	return value.map((v) => {
		if (typeof v !== 'object' || v === null) {
			return v;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
		const newObj = { ...(v as any) };
		const chunkedArgs = chunk(extraArgs, [2]) as string[][];
		chunkedArgs.forEach(([from, to]) => {
			if (from in newObj) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				newObj[to] = newObj[from];
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				delete newObj[from];
			}
		});
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return newObj;
	});
}

function merge(value: unknown[], extraArgs: unknown[][]): unknown[] {
	const [others] = extraArgs;
	if (!Array.isArray(others)) {
		throw new ExpressionExtensionError(
			'merge requires 1 argument that is an array. e.g. .merge([{ id: 1, otherValue: 3 }])',
		);
	}
	const listLength = value.length > others.length ? value.length : others.length;
	const newList = new Array(listLength);
	for (let i = 0; i < listLength; i++) {
		if (value[i] !== undefined) {
			if (typeof value[i] === 'object' && typeof others[i] === 'object') {
				newList[i] = oMerge(value[i] as object, [others[i]]);
			} else {
				newList[i] = value[i];
			}
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			newList[i] = others[i];
		}
	}
	return newList;
}

function union(value: unknown[], extraArgs: unknown[][]): unknown[] {
	const [others] = extraArgs;
	if (!Array.isArray(others)) {
		throw new ExpressionExtensionError(
			'union requires 1 argument that is an array. e.g. .union([1, 2, 3, 4])',
		);
	}
	const newArr: unknown[] = Array.from(value);
	for (const v of others) {
		if (newArr.findIndex((w) => deepCompare(w, v)) === -1) {
			newArr.push(v);
		}
	}
	return unique(newArr, []);
}

function difference(value: unknown[], extraArgs: unknown[][]): unknown[] {
	const [others] = extraArgs;
	if (!Array.isArray(others)) {
		throw new ExpressionExtensionError(
			'difference requires 1 argument that is an array. e.g. .difference([1, 2, 3, 4])',
		);
	}
	const newArr: unknown[] = [];
	for (const v of value) {
		if (others.findIndex((w) => deepCompare(w, v)) === -1) {
			newArr.push(v);
		}
	}
	return unique(newArr, []);
}

function intersection(value: unknown[], extraArgs: unknown[][]): unknown[] {
	const [others] = extraArgs;
	if (!Array.isArray(others)) {
		throw new ExpressionExtensionError(
			'difference requires 1 argument that is an array. e.g. .difference([1, 2, 3, 4])',
		);
	}
	const newArr: unknown[] = [];
	for (const v of value) {
		if (others.findIndex((w) => deepCompare(w, v)) !== -1) {
			newArr.push(v);
		}
	}
	for (const v of others) {
		if (value.findIndex((w) => deepCompare(w, v)) !== -1) {
			newArr.push(v);
		}
	}
	return unique(newArr, []);
}

export const arrayExtensions: ExtensionMap = {
	typeName: 'Array',
	functions: {
		count: length,
		duplicates: unique,
		filter,
		first,
		last,
		length,
		pluck,
		unique,
		random,
		randomItem: random,
		remove: unique,
		size: length,
		sum,
		min,
		max,
		average,
		isPresent,
		isBlank,
		compact,
		smartJoin,
		chunk,
		renameKeys,
		merge,
		union,
		difference,
		intersection,
	},
};
