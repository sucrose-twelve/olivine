class Ruka {
    tracks = [];
    async setTimeout(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async downloader(segment) {
        const MAX_RETRIES = 10;
        const DELAY = 1000;
        let retries = 0;
        const headers = new Headers();
        if (segment?.range)
            headers.set("Range", segment.range);
        while (true) {
            try {
                const response = await fetch(segment.url, {
                    method: "GET",
                    mode: "cors",
                    credentials: "omit",
                    headers
                });
                const raw = await response.arrayBuffer();
                const blob = new Blob([raw], { type: segment.mimeType });
                const formData = new FormData();
                formData.append("file", blob, segment.fileName);
                formData.append("fileName", segment.fileName);
                formData.append("mimeType", segment.mimeType);
                formData.append("savedPath", segment.savedPath);
                const res = await fetch("http://localhost:3000/segment", {
                    method: "POST",
                    body: formData
                });
                const result = await res.json();
                return result.ok;
            }
            catch (error) {
                retries++;
                console.warn(`🚫 An error occurred (attempt ${retries}/${MAX_RETRIES}): ${error}`);
                if (retries >= MAX_RETRIES) {
                    console.warn("🚫 Max retries reached, stopping loop.");
                    break;
                }
                // Exponential backoff: 1s → 2s → 4s
                await this.setTimeout(DELAY * 2 ** (retries - 1));
            }
        }
        return retries !== MAX_RETRIES;
    }
    async processor(segments) {
        let status = 0;
        for await (const lists of segments) {
            const results = await Promise.allSettled(lists.map(this.downloader));
            if (results.some((r) => r.status === "fulfilled" && r.value === false)) {
                status++;
                break;
            }
        }
        return status < 1;
    }
    async convertor(track) {
        const response = await fetch("http://localhost:3000/convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(track)
        });
        const result = await response.json();
        return result.ok;
    }
    async start(source) {
        const res = await fetch(`http://localhost:3000/tracks?source=${source}`, { method: "GET" });
        if (res.ok) {
            this.tracks = await res.json();
            this.setTimeout(1000);
            console.log("📄 Data preparation is completed.");
        }
        else {
            console.warn("⛔ Server offline!");
            return null;
        }
        for await (const track of this.tracks) {
            console.log(`🚀 The track "${track.name}" is currently being process...`);
            const response = await fetch("http://localhost:3000/segment", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(track)
            });
            const segments = await response.json();
            const result = await this.processor(segments);
            if (result) {
                const success = await this.convertor(track);
                if (success) {
                    console.log(`✅ The track "${track.name}" has been successfully processed`);
                }
                else {
                    console.log(`⛔ The track "${track.name}" failed to convert`);
                }
            }
            else {
                console.log(`⛔ The track "${track.name}" failed to process`);
            }
            console.log("\r");
        }
        console.log("🎉 All states have been successfully processed!");
    }
}
export {};
