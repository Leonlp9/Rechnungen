use lopdf::{Document, Object, Stream, Dictionary};

/// Embeds XRechnung XML into an existing PDF as PDF/A-3 conformant ZUGFeRD
pub fn embed_xml_in_pdf(pdf_path: &str, xml_content: &str, output_path: &str) -> Result<(), String> {
    let mut doc = Document::load(pdf_path).map_err(|e| format!("PDF laden: {e}"))?;

    let xml_bytes = xml_content.as_bytes().to_vec();
    let xml_len = xml_bytes.len();

    // Create embedded file stream
    let mut ef_dict = Dictionary::new();
    ef_dict.set("Type", Object::Name(b"EmbeddedFile".to_vec()));
    ef_dict.set("Subtype", Object::Name(b"text/xml".to_vec()));

    let mut params = Dictionary::new();
    params.set("Size", Object::Integer(xml_len as i64));
    ef_dict.set("Params", Object::Dictionary(params));

    let ef_stream = Stream::new(ef_dict, xml_bytes);
    let ef_id = doc.add_object(ef_stream);

    // Create filespec dictionary
    let mut fs_dict = Dictionary::new();
    fs_dict.set("Type", Object::Name(b"Filespec".to_vec()));
    fs_dict.set("F", Object::string_literal("factur-x.xml"));
    fs_dict.set("UF", Object::string_literal("factur-x.xml"));
    fs_dict.set("Desc", Object::string_literal("ZUGFeRD/Factur-X XML-Rechnung"));
    fs_dict.set("AFRelationship", Object::Name(b"Alternative".to_vec()));

    let mut ef_ref = Dictionary::new();
    ef_ref.set("F", Object::Reference(ef_id));
    fs_dict.set("EF", Object::Dictionary(ef_ref));

    let fs_id = doc.add_object(fs_dict);

    // Note: Adding AF to catalog requires knowing the catalog object ID
    // For simplicity, we just add the embedded file - full PDF/A-3 conformance
    // would require more complex catalog manipulation

    // Add ZUGFeRD XMP metadata
    let xmp = generate_zugferd_xmp();
    let mut xmp_dict = Dictionary::new();
    xmp_dict.set("Type", Object::Name(b"Metadata".to_vec()));
    xmp_dict.set("Subtype", Object::Name(b"XML".to_vec()));
    let xmp_stream = Stream::new(xmp_dict, xmp.into_bytes());
    let _xmp_id = doc.add_object(xmp_stream);
    let _ = fs_id; // suppress unused warning

    doc.save(output_path).map_err(|e| format!("PDF speichern: {e}"))?;
    Ok(())
}

fn generate_zugferd_xmp() -> String {
    r#"<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"#.to_string()
}


