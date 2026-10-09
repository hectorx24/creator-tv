package com.patreontv.personal;

import org.json.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Small adapters around the original authenticated transport; never change membership checks. */
public final class CatalogExtension {
    private static final Map<String, JSONObject> metadata = new HashMap<>();
    private static boolean taxonomy(String type) { return type != null && type.toLowerCase(Locale.ROOT).matches(".*(collection|tag|podcast|series|show).*"); }
    private static String safeRelated(String source, String link) throws Exception {
        URI u = new URI(source).resolve(link);
        if (!"https".equals(u.getScheme()) || !("www.patreon.com".equals(u.getHost()) || "patreon.com".equals(u.getHost())) || !u.getPath().startsWith("/api/") || u.getUserInfo() != null) throw new Exception("Metadata origin not allowed");
        return u.toString();
    }
    private static void name(JSONArray dest, JSONObject resource) {
        JSONObject attrs = resource.optJSONObject("attributes"); if (attrs == null) return;
        String value = attrs.optString("name", attrs.optString("title", ""));
        if (value.isEmpty() || value.equals("null")) return;
        for (int i=0;i<dest.length();i++) if(value.equals(dest.optString(i))) return;
        dest.put(value);
    }
    private static void names(JSONArray dest, Object data) {
        if(data instanceof JSONArray) { JSONArray a=(JSONArray)data; for(int i=0;i<a.length();i++) if(a.optJSONObject(i)!=null) name(dest,a.optJSONObject(i)); }
        else if(data instanceof JSONObject) name(dest,(JSONObject)data);
    }
    private static void taxonomy(Object api, JSONObject j, String source) throws Exception {
        Map<String,JSONObject> included = new HashMap<>(); JSONArray inc=j.optJSONArray("included");
        if(inc!=null) for(int i=0;i<inc.length();i++) { JSONObject r=inc.optJSONObject(i); if(r!=null) included.put(r.optString("type")+":"+r.optString("id"),r); }
        JSONArray posts=j.optJSONArray("data"); if(posts==null) return;
        int attempts=0;
        for(int i=0;i<posts.length();i++) {
            JSONObject post=posts.optJSONObject(i); if(post==null) continue; JSONObject attrs=post.optJSONObject("attributes"); if(attrs==null) continue;
            JSONArray labels=new JSONArray(); JSONObject rels=post.optJSONObject("relationships");
            if(rels!=null) for(Iterator<String> keys=rels.keys();keys.hasNext();) {
                String key=keys.next(); JSONObject relation=rels.optJSONObject(key); if(relation==null) continue;
                Object ids=relation.opt("data"); JSONArray refs=ids instanceof JSONArray ? (JSONArray)ids : new JSONArray();
                if(ids instanceof JSONObject) refs.put(ids);
                boolean relevant=taxonomy(key), unresolved=false;
                for(int k=0;k<refs.length();k++) { JSONObject ref=refs.optJSONObject(k); if(ref==null) continue;
                    if(taxonomy(ref.optString("type"))) relevant=true;
                    JSONObject item=included.get(ref.optString("type")+":"+ref.optString("id"));
                    if(item!=null && (taxonomy(key)||taxonomy(item.optString("type")))) name(labels,item); else if(relevant) unresolved=true;
                }
                if(!relevant) continue;
                JSONObject links=relation.optJSONObject("links"); String related=links==null?"":links.optString("related","");
                if(links!=null&&links.optJSONObject("related")!=null) related=links.getJSONObject("related").optString("href","");
                // Follow only relationships supplied by Patreon. No guessed collection/show endpoints.
                if(!related.isEmpty() && (unresolved||refs.length()==0) && attrs.optBoolean("current_user_can_view",false)) {
                    try {
                        String url=safeRelated(source,related); JSONObject resource;
                        synchronized(metadata) { resource=metadata.get(url); }
                        if(resource==null) {
                            if(attempts++>=12) { attrs.put("__personal_metadata_pending",true); continue; }
                            resource=new JSONObject(original(api,url));
                            synchronized(metadata) { if(metadata.size()>300) metadata.clear(); metadata.put(url,resource); }
                        }
                        names(labels,resource.opt("data"));
                    } catch(Exception ignored) { attrs.put("__personal_metadata_unavailable",true); }
                }
            }
            attrs.put("__personal_categories",labels);
        }
    }
    private static String original(Object api, String url) throws Exception {
        Method m = api.getClass().getDeclaredMethod("patreonFetch", String.class);
        m.setAccessible(true);
        try { return (String)m.invoke(api, url); }
        catch (InvocationTargetException e) { Throwable cause = e.getCause(); if (cause instanceof Exception) throw (Exception)cause; throw e; }
    }
    private static String next(JSONObject j, String original) throws Exception {
        JSONObject links = j.optJSONObject("links");
        String link = links == null ? "" : links.optString("next", "");
        if (links != null && links.optJSONObject("next") != null) link = links.getJSONObject("next").optString("href", "");
        if (!link.isEmpty() && !link.equals("null")) {
            URI target = link.startsWith("?") ? new URI(original.split("\\?",2)[0]+link) : new URI(original).resolve(link);
            if (!"https".equals(target.getScheme()) || !("www.patreon.com".equals(target.getHost()) || "patreon.com".equals(target.getHost())) || !target.getPath().startsWith("/api/") || target.getUserInfo() != null)
                throw new Exception("Pagination origin not allowed");
            return target.toString();
        }
        JSONObject meta = j.optJSONObject("meta");
        JSONObject pagination = meta == null ? null : meta.optJSONObject("pagination");
        JSONObject cursors = pagination == null ? null : pagination.optJSONObject("cursors");
        String cursor = cursors == null ? "" : cursors.optString("next", "");
        return cursor.isEmpty() || cursor.equals("null") ? null : original.replaceAll("([&?])page\\[cursor\\]=[^&]*", "$1").replaceAll("[&?]$", "") + (original.contains("?") ? "&" : "?") + "page[cursor]=" + URLEncoder.encode(cursor, "UTF-8");
    }
    public static String campaigns(Object api, String url) throws Exception {
        JSONObject first = null; JSONArray included = new JSONArray(); JSONArray data = new JSONArray(); Set<String> seen = new HashSet<>();
        String target = url;
        for (int page = 0; target != null; page++) {
            if (page >= 200 || !seen.add(target)) throw new Exception("Creator pagination did not finish; retry");
            JSONObject j = new JSONObject(original(api, target));
            if (first == null) first = j;
            for (String field : new String[]{"included", "data"}) {
                JSONArray source = j.optJSONArray(field); JSONArray dest = field.equals("included") ? included : data;
                if (source != null) for (int i = 0; i < source.length(); i++) dest.put(source.get(i));
            }
            target = next(j, target);
        }
        if (first == null) first = new JSONObject();
        first.put("included", included).put("data", data);
        return first.toString();
    }
    public static String posts(Object api, String url) throws Exception {
        String target = url;
        for (String part : new URI(url).getRawQuery().split("&")) {
            if (part.startsWith("page[cursor]=")) {
                String value = URLDecoder.decode(part.substring(part.indexOf('=') + 1), "UTF-8");
                if (value.startsWith("__next_url__:")) {
                    target = new String(Base64.getUrlDecoder().decode(value.substring(13)), StandardCharsets.UTF_8);
                    URI u = new URI(target);
                    if (!"https".equals(u.getScheme()) || !"www.patreon.com".equals(u.getHost()) || !u.getPath().startsWith("/api/") || u.getUserInfo() != null)
                        throw new Exception("Pagination origin not allowed");
                }
            }
        }
        // Let the working website endpoint supply its default metadata/relationships first.
        // Some deployments require explicit fields: retain the compatible original query as a fallback.
        String rich=target.replaceAll("&fields\\[post\\]=[^&]*", "");
        JSONObject j;
        try { j=new JSONObject(original(api,rich)); }
        catch(Exception e) { if(!String.valueOf(e.getMessage()).contains("API error: 400")) throw e; j=new JSONObject(original(api,target)); }
        JSONArray results=j.optJSONArray("data");
        if(results!=null&&results.length()>0&&results.optJSONObject(0)!=null) {
            JSONObject attrs=results.optJSONObject(0).optJSONObject("attributes");
            if(attrs==null||!attrs.has("title")||!attrs.has("current_user_can_view")) j=new JSONObject(original(api,target));
        }
        taxonomy(api,j,target);
        String next = next(j, target);
        if (next != null) {
            JSONObject meta = j.optJSONObject("meta"); if (meta == null) { meta = new JSONObject(); j.put("meta", meta); }
            JSONObject pagination = meta.optJSONObject("pagination"); if (pagination == null) { pagination = new JSONObject(); meta.put("pagination", pagination); }
            JSONObject cursors = pagination.optJSONObject("cursors"); if (cursors == null) { cursors = new JSONObject(); pagination.put("cursors", cursors); }
            // Preserve an original cursor. Only synthesize an opaque token when the API uses links.next instead.
            if (cursors.optString("next", "").isEmpty() || cursors.isNull("next")) cursors.put("next", "__next_url__:" + Base64.getUrlEncoder().withoutPadding().encodeToString(next.getBytes(StandardCharsets.UTF_8)));
        }
        return j.toString();
    }
    public static void enrich(JSONObject post, JSONObject attrs) throws Exception {
        String postType = attrs.isNull("post_type") ? "" : attrs.optString("post_type", "");
        if ("null".equalsIgnoreCase(postType)) postType = "";
        post.put("postType", postType);

        String desc = attrs.isNull("content") ? "" : attrs.optString("content", "");
        if ("null".equalsIgnoreCase(desc) || "undefined".equalsIgnoreCase(desc)) desc = "";
        post.put("description", desc);

        JSONObject file = attrs.optJSONObject("post_file");
        String mediaUrl = file == null || file.isNull("url") ? "" : file.optString("url", "");
        if ("null".equalsIgnoreCase(mediaUrl)) mediaUrl = "";
        post.put("mediaUrl", mediaUrl);

        String mimeType = file == null || file.isNull("type") ? "" : file.optString("type", "");
        if ("null".equalsIgnoreCase(mimeType)) mimeType = "";
        post.put("mimeType", mimeType);

        JSONArray tags = attrs.optJSONArray("post_tags"); JSONArray categories = new JSONArray();
        if (tags != null) for (int i = 0; i < tags.length(); i++) {
            Object tag = tags.opt(i); String name = tag instanceof JSONObject ? ((JSONObject)tag).optString("name", "") : tag instanceof String ? (String)tag : "";
            if (!name.isEmpty() && !"null".equalsIgnoreCase(name)) categories.put(name);
        }
        JSONArray discovered=attrs.optJSONArray("__personal_categories");
        if(discovered!=null) for(int i=0;i<discovered.length();i++) {
            Object val = discovered.get(i);
            if (val != null && !"null".equalsIgnoreCase(String.valueOf(val))) categories.put(val);
        }
        post.put("categories", categories);
        post.put("metadataUnavailable", attrs.optBoolean("__personal_metadata_unavailable",false));
        post.put("metadataPending", attrs.optBoolean("__personal_metadata_pending",false));
    }
}
